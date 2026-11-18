import { db, rpc, rows } from "./db";

export interface SavedLocation {
  id: string;
  label: string;
  address: string;
  area: string;
  lat: number | null;
  lng: number | null;
  isDefault: boolean;
  updatedAt: string;
}

/** A location chosen for one pickup (copied onto the pickup, so later default changes never move it). */
export interface PickupLocation {
  address: string;
  area: string;
  lat: number | null;
  lng: number | null;
  /** "gps" = device position, "pin" = adjusted on the map, "manual" = typed only, "saved" = from a saved location. */
  source: "gps" | "pin" | "manual" | "saved";
  accuracyM?: number | undefined;
}

type Row = {
  id: string;
  label: string;
  address: string;
  area: string;
  lat: number | null;
  lng: number | null;
  is_default: boolean;
  updated_at: string;
};
const map = (r: Row): SavedLocation => ({
  id: r.id,
  label: r.label,
  address: r.address,
  area: r.area,
  lat: r.lat,
  lng: r.lng,
  isDefault: r.is_default,
  updatedAt: r.updated_at,
});

export async function listSavedLocations(): Promise<SavedLocation[]> {
  const data = await rows<Row>(
    db
      .from("saved_locations")
      .select("*")
      .order("is_default", { ascending: false })
      .order("updated_at", { ascending: false }),
  );
  return data.map(map);
}

/** Create (no id) or update a saved location. */
export async function saveLocation(input: {
  id?: string | undefined;
  label: string;
  address: string;
  area: string;
  lat: number | null;
  lng: number | null;
  isDefault: boolean;
}): Promise<SavedLocation> {
  const r = await rpc<Row>("save_location", {
    _id: input.id ?? null,
    _label: input.label,
    _address: input.address,
    _area: input.area,
    _lat: input.lat,
    _lng: input.lng,
    _is_default: input.isDefault,
  });
  return map(r);
}

export async function deleteSavedLocation(id: string): Promise<void> {
  await rpc("delete_saved_location", { _id: id });
}

/** Ask the browser for the device position. Rejects with a plain-language message. */
export function getDevicePosition(): Promise<{ lat: number; lng: number; accuracyM: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("This device can't share its location. Type your address instead."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracyM: Math.round(p.coords.accuracy),
        }),
      (e) =>
        reject(
          new Error(
            e.code === e.PERMISSION_DENIED
              ? "Location permission was denied. Type your address instead."
              : "We couldn't get your location. Try again or type your address.",
          ),
        ),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
    );
  });
}
