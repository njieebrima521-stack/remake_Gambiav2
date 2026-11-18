import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";
/** Max new address lookups per call, so one page load can never fan out into many paid requests. */
const MAX_LOOKUPS = 25;

export interface StopLocation {
  ref: string;
  lat: number;
  lng: number;
  /** "geocode" = street address found; "area" = placed at the area centre (approximate). */
  source: "geocode" | "area" | "manual";
}

type Geo = { lat: number; lng: number; precise: boolean } | null;

async function geocode(query: string, lovableKey: string, mapsKey: string): Promise<Geo> {
  const url = `${GATEWAY_URL}/maps/api/geocode/json?address=${encodeURIComponent(query)}&components=country:GM&region=gm`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": mapsKey },
  });
  if (res.status === 403) {
    const body = await res.text();
    console.error(`Google Maps geocode denied [403]: ${body}`);
    throw new Error(
      "Google Maps refused the address lookup (403). Check the Google Maps connection.",
    );
  }
  if (!res.ok) {
    const body = await res.text();
    console.error(`Google Maps geocode failed [${res.status}]: ${body}`);
    throw new Error(`Address lookup failed [${res.status}]`);
  }
  const json = (await res.json()) as {
    status: string;
    error_message?: string;
    results?: { types: string[]; geometry: { location: { lat: number; lng: number } } }[];
  };
  if (json.status === "ZERO_RESULTS") return null;
  if (json.status !== "OK")
    throw new Error(
      `Address lookup failed: ${json.status}${json.error_message ? ` · ${json.error_message}` : ""}`,
    );
  const r = json.results?.[0];
  if (!r) return null;
  // A country-level match means Google didn't recognise the place.
  if (r.types.includes("country")) return null;
  return {
    ...r.geometry.location,
    precise: !r.types.some((t) => t === "locality" || t.startsWith("administrative_area")),
  };
}

/**
 * Map positions for the signed-in collector's assigned pickups. Addresses are looked up
 * once through Google Maps and saved, so later visits cost nothing.
 */
export const locateMyStops = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("pickups")
      .select("id, ref, address, area, status, pickup_locations(lat, lng, source)")
      .eq("collector_id", userId)
      .order("preferred_date", { ascending: true })
      .limit(150);
    if (error) throw new Error(error.message);

    const rows = (data ?? []).map((r) => {
      const loc = Array.isArray(r.pickup_locations) ? r.pickup_locations[0] : r.pickup_locations;
      return { ...r, loc: loc ?? null };
    });
    const out: StopLocation[] = rows
      .filter((r) => r.loc)
      .map((r) => ({
        ref: r.ref,
        lat: r.loc!.lat,
        lng: r.loc!.lng,
        source: r.loc!.source as StopLocation["source"],
      }));

    const missing = rows
      .filter((r) => !r.loc)
      .sort((a, b) => Number(b.status === "scheduled") - Number(a.status === "scheduled"));
    let notFound = 0;
    if (missing.length) {
      const lovableKey = process.env["LOVABLE_API_KEY"];
      const mapsKey = process.env["GOOGLE_MAPS_API_KEY"];
      if (!mapsKey || !lovableKey) {
        return {
          locations: out,
          notFound: missing.length,
          pending: 0,
          geocodingAvailable: false,
        };
      }
      const areaCache = new Map<string, Geo>();
      for (const r of missing.slice(0, MAX_LOOKUPS)) {
        let geo = r.address.trim()
          ? await geocode(`${r.address}, ${r.area}, The Gambia`, lovableKey, mapsKey)
          : null;
        let source: StopLocation["source"] = "geocode";
        if (!geo || !geo.precise) {
          const key = r.area.trim().toLowerCase();
          if (!areaCache.has(key))
            areaCache.set(key, await geocode(`${r.area}, The Gambia`, lovableKey, mapsKey));
          const area = areaCache.get(key) ?? null;
          if (!geo) {
            geo = area;
            source = "area";
          } else if (
            area &&
            Math.abs(area.lat - geo.lat) < 1e-6 &&
            Math.abs(area.lng - geo.lng) < 1e-6
          )
            source = "area";
        }
        if (!geo) {
          notFound++;
          continue;
        }
        const { error: saveErr } = await supabase.rpc("set_pickup_location", {
          _pickup: r.id,
          _lat: geo.lat,
          _lng: geo.lng,
          _source: source,
          _label: `${r.address}, ${r.area}`,
        });
        if (saveErr) throw new Error(saveErr.message);
        out.push({ ref: r.ref, lat: geo.lat, lng: geo.lng, source });
      }
    }
    return {
      locations: out,
      notFound,
      pending: Math.max(0, missing.length - MAX_LOOKUPS),
      geocodingAvailable: true,
    };
  });
