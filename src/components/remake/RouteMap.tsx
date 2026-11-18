/// <reference types="google.maps" />
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Crosshair, Loader2, LocateFixed, LocateOff, Maximize2, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { locateMyStops, type StopLocation } from "@/lib/remake/route-map.functions";
import { loadGoogleMaps, MAPS_AUTH_FAILED_EVENT } from "@/lib/remake/google-maps";
import { distanceKm, errorMessage } from "@/lib/remake/logic";
import { cn } from "@/lib/utils";

export interface MapStop {
  ref: string;
  customer: string;
  address: string;
  area: string;
  when: string;
  open: boolean;
}

const DEFAULT_CENTER = { lat: 13.4549, lng: -16.6788 }; // Kanifing / Serrekunda

/** Resolve a theme colour token to rgb() so Google Maps symbols can use it. */
function tokenColor(name: string, fallback: string): string {
  try {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    const ctx = c.getContext("2d")!;
    const probe = document.createElement("span");
    probe.style.color = `var(${name})`;
    document.body.appendChild(probe);
    ctx.fillStyle = getComputedStyle(probe).color || fallback;
    probe.remove();
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return `rgb(${r}, ${g}, ${b})`;
  } catch {
    return fallback;
  }
}

export function RouteMap({ stops }: { stops: MapStop[] }) {
  const navigate = useNavigate();
  const locate = useServerFn(locateMyStops);
  const refsKey = useMemo(
    () =>
      stops
        .map((s) => s.ref)
        .sort()
        .join(","),
    [stops],
  );
  const locQuery = useQuery({
    queryKey: ["route-locations", refsKey],
    queryFn: () => locate(),
    enabled: stops.length > 0,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const stopMarkers = useRef<google.maps.Marker[]>([]);
  const meMarker = useRef<google.maps.Marker | null>(null);
  const meCircle = useRef<google.maps.Circle | null>(null);
  const line = useRef<google.maps.Polyline | null>(null);
  const info = useRef<google.maps.InfoWindow | null>(null);
  const fitted = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [me, setMe] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [geoState, setGeoState] = useState<"off" | "waiting" | "live" | "denied" | "unavailable">(
    "off",
  );
  const [watchKey, setWatchKey] = useState(0);

  // Load Google Maps and create the map once.
  useEffect(() => {
    let cancelled = false;
    const onAuth = () =>
      setMapError("Google Maps isn't allowed on this web address. The stop list still works.");
    window.addEventListener(MAPS_AUTH_FAILED_EVENT, onAuth);
    loadGoogleMaps()
      .then(() => {
        if (cancelled || !boxRef.current || mapRef.current) return;
        mapRef.current = new google.maps.Map(boxRef.current, {
          center: DEFAULT_CENTER,
          zoom: 12,
          clickableIcons: false,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          gestureHandling: "greedy",
        });
        info.current = new google.maps.InfoWindow();
        setMapReady(true);
      })
      .catch((e) => !cancelled && setMapError(errorMessage(e)));
    return () => {
      cancelled = true;
      window.removeEventListener(MAPS_AUTH_FAILED_EVENT, onAuth);
    };
  }, []);

  // Follow the collector's live position.
  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setGeoState("unavailable");
      return;
    }
    setGeoState("waiting");
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setMe({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy });
        setGeoState("live");
      },
      (err) => setGeoState(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable"),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 30_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [watchKey]);

  const byRef = useMemo(
    () => new Map((locQuery.data?.locations ?? []).map((l) => [l.ref, l])),
    [locQuery.data],
  );
  const placed = stops
    .map((s, i) => ({ stop: s, n: i + 1, loc: byRef.get(s.ref) }))
    .filter((x): x is { stop: MapStop; n: number; loc: StopLocation } => !!x.loc);
  const approx = placed.filter((p) => p.loc.source === "area").length;
  const nextOpen = placed.find((p) => p.stop.open);
  const nextKm = me && nextOpen ? distanceKm(me, nextOpen.loc) : null;

  const fitAll = () => {
    const map = mapRef.current;
    if (!map) return;
    const b = new google.maps.LatLngBounds();
    placed.forEach((p) => b.extend(p.loc));
    if (me) b.extend(me);
    if (b.isEmpty()) return;
    map.fitBounds(b, 48);
    if (placed.length + (me ? 1 : 0) === 1) map.setZoom(15);
  };

  // Stop markers.
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    stopMarkers.current.forEach((m) => m.setMap(null));
    const brand = tokenColor("--primary", "rgb(22, 128, 80)");
    const muted = tokenColor("--muted-foreground", "rgb(120, 120, 120)");
    stopMarkers.current = placed.map(({ stop, n, loc }) => {
      const marker = new google.maps.Marker({
        map,
        position: loc,
        title: `${n}. ${stop.customer}`,
        label: { text: String(n), color: "#ffffff", fontWeight: "700", fontSize: "12px" },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 13,
          fillColor: stop.open ? brand : muted,
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
        zIndex: stop.open ? 10 : 5,
      });
      marker.addListener("click", () => {
        const el = document.createElement("div");
        el.style.cssText = "font: 13px/1.4 system-ui, sans-serif; max-width: 220px; color: #1a1a1a";
        const title = document.createElement("b");
        title.textContent = `${n}. ${stop.customer}`;
        const addr = document.createElement("div");
        addr.textContent = `${stop.address}, ${stop.area}${loc.source === "area" ? " (approximate)" : ""}`;
        const when = document.createElement("div");
        when.style.color = "#666";
        when.textContent = stop.when;
        const links = document.createElement("div");
        links.style.cssText = "margin-top: 6px; display: flex; gap: 12px; font-weight: 600";
        const open = document.createElement("a");
        open.href = `/collector/stops/${encodeURIComponent(stop.ref)}`;
        open.textContent = "Open stop";
        open.style.color = brand;
        open.onclick = (e) => {
          e.preventDefault();
          void navigate({ to: "/collector/stops/$id", params: { id: stop.ref } });
        };
        const dir = document.createElement("a");
        dir.href = `https://www.google.com/maps/dir/?api=1&destination=${loc.lat},${loc.lng}&travelmode=driving`;
        dir.target = "_blank";
        dir.rel = "noopener noreferrer";
        dir.textContent = "Directions";
        dir.style.color = brand;
        links.append(open, dir);
        el.append(title, addr, when, links);
        info.current?.setContent(el);
        info.current?.open({ map, anchor: marker });
      });
      return marker;
    });
    if (!fitted.current && placed.length) {
      fitted.current = true;
      fitAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, byRef, stops]);

  // Live position marker and the line through the remaining stops.
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    const blue = tokenColor("--info", "rgb(37, 99, 235)");
    if (me) {
      meMarker.current ??= new google.maps.Marker({ map, title: "You are here", zIndex: 20 });
      meMarker.current.setIcon({
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: blue,
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 3,
      });
      meMarker.current.setPosition(me);
      meCircle.current ??= new google.maps.Circle({
        map,
        fillColor: blue,
        fillOpacity: 0.12,
        strokeColor: blue,
        strokeOpacity: 0.3,
        strokeWeight: 1,
        clickable: false,
      });
      meCircle.current.setCenter(me);
      meCircle.current.setRadius(Math.min(me.accuracy, 2000));
    }
    const path = [...(me ? [me] : []), ...placed.filter((p) => p.stop.open).map((p) => p.loc)];
    line.current ??= new google.maps.Polyline({
      map,
      strokeOpacity: 0,
      icons: [
        {
          icon: {
            path: "M 0,-1 0,1",
            strokeOpacity: 0.8,
            strokeColor: tokenColor("--ink", "rgb(30, 30, 30)"),
            scale: 3,
          },
          offset: "0",
          repeat: "14px",
        },
      ],
    });
    line.current.setPath(path.length > 1 ? path : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, me, byRef, stops]);

  const centerOnMe = () => {
    if (me && mapRef.current) {
      mapRef.current.panTo(me);
      mapRef.current.setZoom(Math.max(mapRef.current.getZoom() ?? 14, 15));
    } else setWatchKey((k) => k + 1);
  };

  const geoLabel = {
    off: "Location off",
    waiting: "Finding you…",
    live: me ? `Live · ±${Math.round(me.accuracy)} m` : "Live",
    denied: "Location blocked",
    unavailable: "Location unavailable",
  }[geoState];

  return (
    <div className="space-y-3">
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-mint">
        <div
          ref={boxRef}
          className={cn("absolute inset-0", mapError && "invisible")}
          aria-label="Route map"
        />
        {(!mapReady || mapError) && (
          <div className="absolute inset-0 grid place-items-center bg-mint p-6 text-center text-sm text-mint-foreground">
            {mapError ? <p>{mapError}</p> : <Loader2 className="size-6 animate-spin" />}
          </div>
        )}
        {mapReady && !mapError && (
          <div className="absolute left-2 top-2 flex gap-1.5">
            <Button
              size="icon"
              variant="secondary"
              className="size-9 shadow-card"
              onClick={centerOnMe}
              aria-label="Centre on my location"
            >
              <Crosshair />
            </Button>
            <Button
              size="icon"
              variant="secondary"
              className="size-9 shadow-card"
              onClick={fitAll}
              aria-label="Show all stops"
            >
              <Maximize2 />
            </Button>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold",
            geoState === "live" ? "bg-info-soft text-info" : "bg-muted text-muted-foreground",
          )}
        >
          {geoState === "live" ? (
            <LocateFixed className="size-3.5" />
          ) : (
            <LocateOff className="size-3.5" />
          )}
          {geoLabel}
        </span>
        {(geoState === "denied" || geoState === "unavailable") && (
          <button className="font-semibold text-primary" onClick={() => setWatchKey((k) => k + 1)}>
            Try again
          </button>
        )}
        {nextKm !== null && nextOpen && (
          <span className="inline-flex items-center gap-1 rounded-full bg-mint px-2.5 py-1 font-semibold text-mint-foreground">
            <Navigation className="size-3.5" />
            Stop {nextOpen.n} ·{" "}
            {nextKm < 1 ? `${Math.round(nextKm * 1000)} m` : `${nextKm.toFixed(1)} km`} away
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {locQuery.isLoading
          ? "Finding your stops on the map…"
          : locQuery.error
            ? `Couldn't place stops: ${errorMessage(locQuery.error)}`
            : stops.length === 0
              ? "No stops to show."
              : locQuery.data &&
                  "geocodingAvailable" in locQuery.data &&
                  locQuery.data.geocodingAvailable === false &&
                  placed.length < stops.length
                ? `${placed.length} of ${stops.length} stops have saved coordinates (address geocoding is not configured).`
                : `${placed.length} of ${stops.length} stops on the map${approx ? ` · ${approx} placed at the area centre` : ""}.`}
        {geoState === "denied" && " Allow location access in your browser to see where you are."}
      </p>
    </div>
  );
}

/**
 * Reuses the exact Google Maps implementation to show a real location pin (and optional
 * secondary pin, e.g. assigned collector) with optional click/drag adjustment.
 */
export function LocationPinMap({
  point,
  secondaryPoint,
  secondaryLabel,
  onAdjust,
  className,
}: {
  point: { lat: number; lng: number } | null;
  secondaryPoint?: { lat: number; lng: number } | null;
  secondaryLabel?: string;
  onAdjust?: (pos: { lat: number; lng: number }) => void;
  className?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const secondaryMarkerRef = useRef<google.maps.Marker | null>(null);
  const adjustRef = useRef(onAdjust);
  adjustRef.current = onAdjust;
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const onAuth = () =>
      setMapError("Google Maps isn't allowed on this domain. Address entry still works.");
    window.addEventListener(MAPS_AUTH_FAILED_EVENT, onAuth);
    loadGoogleMaps()
      .then(() => {
        if (cancelled || !boxRef.current || mapRef.current) return;
        const map = new google.maps.Map(boxRef.current, {
          center: point ?? secondaryPoint ?? DEFAULT_CENTER,
          zoom: point ? 16 : 12,
          clickableIcons: false,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: "greedy",
        });
        if (adjustRef.current) {
          map.addListener("click", (e: google.maps.MapMouseEvent) => {
            if (!e.latLng) return;
            adjustRef.current?.({ lat: e.latLng.lat(), lng: e.latLng.lng() });
          });
        }
        mapRef.current = map;
        setMapReady(true);
      })
      .catch((e) => !cancelled && setMapError(errorMessage(e)));
    return () => {
      cancelled = true;
      window.removeEventListener(MAPS_AUTH_FAILED_EVENT, onAuth);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    if (point) {
      if (!markerRef.current) {
        markerRef.current = new google.maps.Marker({
          map,
          position: point,
          draggable: !!adjustRef.current,
          title: "Pickup location",
        });
        if (adjustRef.current) {
          markerRef.current.addListener("dragend", () => {
            const pos = markerRef.current?.getPosition();
            if (pos) adjustRef.current?.({ lat: pos.lat(), lng: pos.lng() });
          });
        }
      } else {
        markerRef.current.setPosition(point);
        markerRef.current.setDraggable(!!adjustRef.current);
      }
      map.panTo(point);
      if ((map.getZoom() ?? 12) < 15) map.setZoom(16);
    } else if (markerRef.current) {
      markerRef.current.setMap(null);
      markerRef.current = null;
    }

    if (secondaryPoint) {
      const blue = tokenColor("--info", "rgb(37, 99, 235)");
      secondaryMarkerRef.current ??= new google.maps.Marker({
        map,
        title: secondaryLabel ?? "Collector",
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: blue,
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 3,
        },
      });
      secondaryMarkerRef.current.setPosition(secondaryPoint);
    } else if (secondaryMarkerRef.current) {
      secondaryMarkerRef.current.setMap(null);
      secondaryMarkerRef.current = null;
    }
  }, [mapReady, point, secondaryPoint, secondaryLabel]);

  return (
    <div className={cn("relative aspect-[16/9] overflow-hidden rounded-2xl bg-mint", className)}>
      <div
        ref={boxRef}
        className={cn("absolute inset-0", mapError && "invisible")}
        aria-label="Location map"
      />
      {(!mapReady || mapError) && (
        <div className="absolute inset-0 grid place-items-center bg-mint p-4 text-center text-xs text-mint-foreground">
          {mapError ? <p>{mapError}</p> : <Loader2 className="size-5 animate-spin" />}
        </div>
      )}
    </div>
  );
}
