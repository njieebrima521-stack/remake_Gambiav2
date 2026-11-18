import { rpc } from "./db";

export type CollectorDutyStatus = "offline" | "on_duty" | "on_pickup";

export interface CollectorPresence {
  collectorId: string;
  name: string;
  phone: string;
  orgName: string | null;
  status: CollectorDutyStatus;
  sharing: boolean;
  lat: number | null;
  lng: number | null;
  accuracyM: number | null;
  /** ISO time of the last location update. */
  updatedAt: string | null;
  shiftStartedAt: string | null;
  activeAssignment: string | null;
}

/** A location older than this is shown as stale. */
export const STALE_AFTER_MS = 2 * 60 * 1000;
export const isStale = (iso: string | null) =>
  !iso || Date.now() - new Date(iso).getTime() > STALE_AFTER_MS;

type Row = {
  collector_id: string;
  name: string;
  phone: string;
  org_name: string | null;
  status: CollectorDutyStatus;
  sharing: boolean;
  lat: number | null;
  lng: number | null;
  accuracy_m: number | null;
  updated_at: string | null;
  shift_started_at: string | null;
  active_assignment: string | null;
};
const map = (r: Row): CollectorPresence => ({
  collectorId: r.collector_id,
  name: r.name,
  phone: r.phone,
  orgName: r.org_name,
  status: r.status,
  sharing: r.sharing,
  lat: r.lat,
  lng: r.lng,
  accuracyM: r.accuracy_m,
  updatedAt: r.updated_at,
  shiftStartedAt: r.shift_started_at,
  activeAssignment: r.active_assignment,
});

export async function getMyPresence(): Promise<CollectorPresence | null> {
  const data = await rpc<Row[]>("my_collector_presence");
  return data[0] ? map(data[0]) : null;
}

export async function startShift(): Promise<void> {
  await rpc("start_collector_shift");
}
export async function endShift(): Promise<void> {
  await rpc("end_collector_shift");
}
export async function setDutyStatus(status: CollectorDutyStatus): Promise<void> {
  await rpc("set_collector_status", { _status: status });
}

/** Send one position update; the server ignores it unless a shift is active and sharing is on. */
export async function sendLocation(
  lat: number,
  lng: number,
  accuracyM: number | null,
): Promise<void> {
  await rpc("update_collector_location", { _lat: lat, _lng: lng, _accuracy: accuracyM });
}

/** Institution managers see their own collectors; admins see all. */
export async function listFleet(orgId?: string): Promise<CollectorPresence[]> {
  const data = await rpc<Row[]>("institution_fleet", { _org: orgId ?? null });
  return data.map(map);
}

/** Resident sees only the collector assigned to their own pickup, only while that collector is on shift. */
export async function trackPickupCollector(pickupRef: string): Promise<{
  presence: CollectorPresence | null;
  destination: { lat: number; lng: number } | null;
}> {
  const data = await rpc<(Row & { dest_lat: number | null; dest_lng: number | null })[]>(
    "track_pickup_collector",
    { _ref: pickupRef },
  );
  const r = data[0];
  if (!r) return { presence: null, destination: null };
  return {
    presence: r.collector_id ? map(r) : null,
    destination:
      r.dest_lat != null && r.dest_lng != null ? { lat: r.dest_lat, lng: r.dest_lng } : null,
  };
}

export interface ShiftRecord {
  id: string;
  collectorName: string;
  startedAt: string;
  endedAt: string | null;
  updates: number;
}
export async function listShifts(orgId?: string, collectorId?: string): Promise<ShiftRecord[]> {
  const data = await rpc<
    {
      id: string;
      collector_name: string;
      started_at: string;
      ended_at: string | null;
      updates: number;
    }[]
  >("list_collector_shifts", { _org: orgId ?? null, _collector: collectorId ?? null });
  return data.map((r) => ({
    id: r.id,
    collectorName: r.collector_name,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    updates: r.updates,
  }));
}
