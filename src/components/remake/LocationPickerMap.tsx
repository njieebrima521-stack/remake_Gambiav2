/// <reference types="google.maps" />
import { useEffect, useRef, useState } from "react";
import { Loader2, LocateFixed, MapPin, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loadGoogleMaps, MAPS_AUTH_FAILED_EVENT } from "@/lib/remake/google-maps";
import { errorMessage } from "@/lib/remake/logic";
import { getDevicePosition } from "@/lib/remake/services/locations";
import { cn } from "@/lib/utils";

const INITIAL_MAP_VIEW = { lat: 13.4549, lng: -16.6788 }; // Map viewport center only (never saved as a user coordinate)

export interface Coordinates {
  lat: number | null;
  lng: number | null;
  source: "gps" | "pin" | "manual" | "saved";
  accuracyM?: number | undefined;
}

export function LocationPickerMap({
  value,
  onChange,
}: {
  value: Coordinates;
  onChange: (next: Coordinates) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);

  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [geoMessage, setGeoMessage] = useState<string | null>(null);

  // Preserve and reuse the existing Google Maps loader.
  useEffect(() => {
    let cancelled = false;
    const onAuth = () => setMapError("Google Maps isn't allowed on this web address.");
    window.addEventListener(MAPS_AUTH_FAILED_EVENT, onAuth);
    loadGoogleMaps()
      .then(() => {
        if (cancelled || !boxRef.current || mapRef.current) return;
        const center =
          value.lat != null && value.lng != null
            ? { lat: value.lat, lng: value.lng }
            : INITIAL_MAP_VIEW;
        const map = new google.maps.Map(boxRef.current, {
          center,
          zoom: value.lat != null ? 16 : 12,
          clickableIcons: false,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: "greedy",
        });
        map.addListener("click", (e: google.maps.MapMouseEvent) => {
          if (!e.latLng) return;
          onChange({
            lat: Number(e.latLng.lat().toFixed(6)),
            lng: Number(e.latLng.lng().toFixed(6)),
            source: "pin",
          });
          setGeoMessage(null);
        });
        mapRef.current = map;
        setMapReady(true);
      })
      .catch((e) => {
        if (!cancelled) setMapError(errorMessage(e));
      });
    return () => {
      cancelled = true;
      window.removeEventListener(MAPS_AUTH_FAILED_EVENT, onAuth);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep draggable marker synced strictly to actual coordinates (never invent coordinates).
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;

    if (value.lat == null || value.lng == null) {
      if (markerRef.current) {
        markerRef.current.setMap(null);
        markerRef.current = null;
      }
      return;
    }

    const pos = { lat: value.lat, lng: value.lng };
    if (!markerRef.current) {
      const marker = new google.maps.Marker({
        map,
        position: pos,
        draggable: true,
        title: "Pickup location (drag to adjust)",
      });
      marker.addListener("dragend", (e: google.maps.MapMouseEvent) => {
        if (!e.latLng) return;
        onChange({
          lat: Number(e.latLng.lat().toFixed(6)),
          lng: Number(e.latLng.lng().toFixed(6)),
          source: "pin",
        });
        setGeoMessage(null);
      });
      markerRef.current = marker;
    } else {
      markerRef.current.setPosition(pos);
    }
    map.panTo(pos);
    if ((map.getZoom() ?? 12) < 15) map.setZoom(16);
  }, [mapReady, value.lat, value.lng, onChange]);

  const useCurrentLocation = async () => {
    setLocating(true);
    setGeoMessage(null);
    try {
      const pos = await getDevicePosition();
      onChange({
        lat: Number(pos.lat.toFixed(6)),
        lng: Number(pos.lng.toFixed(6)),
        source: "gps",
        accuracyM: pos.accuracyM,
      });
    } catch (e) {
      setGeoMessage(errorMessage(e));
    } finally {
      setLocating(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={useCurrentLocation}
          disabled={locating}
        >
          {locating ? <Loader2 className="animate-spin" /> : <LocateFixed />}
          Use My Current Location
        </Button>
        {value.lat != null && value.lng != null && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange({ lat: null, lng: null, source: "manual" })}
          >
            <RotateCcw className="size-3.5" /> Clear pin
          </Button>
        )}
      </div>

      {geoMessage && (
        <p className="rounded-xl bg-warning-soft px-3 py-2 text-xs text-warning">{geoMessage}</p>
      )}

      <div className="relative h-56 overflow-hidden rounded-2xl border bg-mint">
        <div
          ref={boxRef}
          className={cn("absolute inset-0", mapError && "invisible")}
          aria-label="Pickup location map"
        />
        {(!mapReady || mapError) && (
          <div className="absolute inset-0 grid place-items-center bg-mint p-4 text-center text-xs text-mint-foreground">
            {mapError ? (
              <div className="max-w-xs space-y-1">
                <MapPin className="mx-auto size-5" />
                <p className="font-medium">{mapError}</p>
                <p className="opacity-80">Enter your pickup address manually below.</p>
              </div>
            ) : (
              <Loader2 className="size-5 animate-spin" />
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        {value.lat != null && value.lng != null ? (
          <span className="font-mono">
            {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
            {value.source === "gps" && value.accuracyM ? ` (±${value.accuracyM} m)` : ""}
            {value.source === "pin" ? " · adjusted pin" : ""}
            {value.source === "saved" ? " · saved location" : ""}
          </span>
        ) : (
          <span>No GPS pin selected — address will be recorded manually.</span>
        )}
        {mapReady && !mapError && <span>Tap map or drag pin to adjust</span>}
      </div>
    </div>
  );
}
