import { db, rpc, rows } from "./db";
import type { MaterialTypeId } from "../material-types";

/* ---------- Routing & assignment (admin + institution) ---------- */

export interface AssignmentRequest {
  pickupRef: string;
  pickupId: string;
  materialType: MaterialTypeId;
  area: string;
  date: string;
  customer: string;
  status: "unmatched" | "offered" | "assigned";
  institution: string | null;
  attempts: number;
  /** When the current institution offer expires. */
  expiresAt: string | null;
  attemptId: string | null;
}

type ARow = {
  pickup_ref: string;
  pickup_id: string;
  material_type: MaterialTypeId;
  area: string;
  preferred_date: string;
  customer_name: string;
  assignment_status: AssignmentRequest["status"];
  institution_name: string | null;
  attempts: number;
  expires_at: string | null;
  attempt_id: string | null;
};
const mapA = (r: ARow): AssignmentRequest => ({
  pickupRef: r.pickup_ref,
  pickupId: r.pickup_id,
  materialType: r.material_type,
  area: r.area,
  date: r.preferred_date,
  customer: r.customer_name,
  status: r.assignment_status,
  institution: r.institution_name,
  attempts: r.attempts,
  expiresAt: r.expires_at,
  attemptId: r.attempt_id,
});

/** Admin: unmatched and pending requests. Institution: offers waiting for its answer. */
export async function listAssignmentQueue(
  scope: "admin" | "institution",
  orgId?: string,
): Promise<AssignmentRequest[]> {
  const data = await rpc<ARow[]>("assignment_queue", { _scope: scope, _org: orgId ?? null });
  return data.map(mapA);
}

/** Institution accepts or declines an offer; declining moves the request to the next eligible institution. */
export async function respondToAssignment(
  attemptId: string,
  accept: boolean,
  collectorId?: string,
): Promise<void> {
  await rpc("respond_to_assignment", {
    _attempt: attemptId,
    _accept: accept,
    _collector: collectorId ?? null,
  });
}

/** Admin: re-run routing for one pickup (e.g. after approving a specialisation). */
export async function reroutePickup(pickupId: string): Promise<void> {
  await rpc("route_pickup", { _pickup: pickupId });
}

/** Expire overdue offers and retry routing. Safe to call any time. */
export async function processAssignmentTimeouts(): Promise<number> {
  return rpc<number>("process_assignment_timeouts");
}

/* ---------- Disputes ---------- */

export interface Dispute {
  id: string;
  pickupRef: string;
  raisedBy: string;
  reason: string;
  status: "open" | "resolved" | "dismissed";
  resolution: string | null;
  createdAt: string;
}
type DRow = {
  id: string;
  pickup_ref: string;
  raised_by_name: string;
  reason: string;
  status: Dispute["status"];
  resolution: string | null;
  created_at: string;
};
export async function listDisputes(): Promise<Dispute[]> {
  const data = await rpc<DRow[]>("list_disputes");
  return data.map((r) => ({
    id: r.id,
    pickupRef: r.pickup_ref,
    raisedBy: r.raised_by_name,
    reason: r.reason,
    status: r.status,
    resolution: r.resolution,
    createdAt: r.created_at,
  }));
}
export async function raiseDispute(pickupRef: string, reason: string): Promise<void> {
  await rpc("raise_dispute", { _ref: pickupRef, _reason: reason });
}
export async function resolveDispute(
  id: string,
  status: "resolved" | "dismissed",
  resolution: string,
): Promise<void> {
  await rpc("admin_resolve_dispute", { _id: id, _status: status, _resolution: resolution });
}

/* ---------- Analytics ---------- */

export interface InstitutionAnalytics {
  totalKg: number;
  verifiedKg: number;
  completedCollections: number;
  pendingCollections: number;
  activeAssignments: number;
  activeCollectors: number;
  trend: { day: string; kg: number; count: number }[];
  composition: { materialType: string; kg: number }[];
  collectors: {
    collectorId: string;
    name: string;
    completed: number;
    verifiedKg: number;
    active: number;
    status: string;
  }[];
}

/** Aggregates for an institution (or all, for admins) between two dates (yyyy-mm-dd, inclusive). */
export async function getInstitutionAnalytics(
  from: string,
  to: string,
  orgId?: string,
): Promise<InstitutionAnalytics> {
  const r = await rpc<{
    total_kg: number;
    verified_kg: number;
    completed: number;
    pending: number;
    active_assignments: number;
    active_collectors: number;
    trend: { day: string; kg: number; count: number }[] | null;
    composition: { material_type: string; kg: number }[] | null;
    collectors:
      | {
          collector_id: string;
          name: string;
          completed: number;
          verified_kg: number;
          active: number;
          status: string;
        }[]
      | null;
  }>("institution_analytics", { _from: from, _to: to, _org: orgId ?? null });
  return {
    totalKg: Number(r.total_kg ?? 0),
    verifiedKg: Number(r.verified_kg ?? 0),
    completedCollections: r.completed ?? 0,
    pendingCollections: r.pending ?? 0,
    activeAssignments: r.active_assignments ?? 0,
    activeCollectors: r.active_collectors ?? 0,
    trend: (r.trend ?? []).map((t) => ({ day: t.day, kg: Number(t.kg), count: t.count })),
    composition: (r.composition ?? []).map((c) => ({
      materialType: c.material_type,
      kg: Number(c.kg),
    })),
    collectors: (r.collectors ?? []).map((c) => ({
      collectorId: c.collector_id,
      name: c.name,
      completed: c.completed,
      verifiedKg: Number(c.verified_kg),
      active: c.active,
      status: c.status,
    })),
  };
}

/* ---------- Activity / audit ---------- */

export interface ActivityEntry {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  actor: string;
  details: Record<string, unknown>;
  createdAt: string;
}
export async function listActivity(limit = 100): Promise<ActivityEntry[]> {
  const data = await rows<{
    id: string;
    action: string;
    entity: string;
    entity_id: string;
    actor_id: string | null;
    details: Record<string, unknown> | null;
    created_at: string;
    profiles?: { full_name: string } | null;
  }>(db.from("admin_logs").select("*").order("created_at", { ascending: false }).limit(limit));
  return data.map((r) => ({
    id: r.id,
    action: r.action,
    entity: r.entity,
    entityId: r.entity_id,
    actor: r.profiles?.full_name ?? "System",
    details: r.details ?? {},
    createdAt: r.created_at,
  }));
}

/* ---------- Routing configuration ---------- */

export interface RoutingConfig {
  assignmentTimeoutMinutes: number;
  maxAttempts: number;
  weightDistance: number;
  weightWorkload: number;
  weightCapacity: number;
}
export async function getRoutingConfig(): Promise<RoutingConfig> {
  const data = await rows<{ key: string; value: number }>(
    db.from("platform_settings").select("key,value").like("key", "routing_%"),
  );
  const get = (k: string, d: number) => Number(data.find((r) => r.key === k)?.value ?? d);
  return {
    assignmentTimeoutMinutes: get("routing_timeout_minutes", 30),
    maxAttempts: get("routing_max_attempts", 5),
    weightDistance: get("routing_weight_distance", 1),
    weightWorkload: get("routing_weight_workload", 1),
    weightCapacity: get("routing_weight_capacity", 1),
  };
}
export async function setRoutingConfig(
  key:
    | "routing_timeout_minutes"
    | "routing_max_attempts"
    | "routing_weight_distance"
    | "routing_weight_workload"
    | "routing_weight_capacity",
  value: number,
): Promise<void> {
  await rpc("admin_set_setting", { _key: key, _value: value });
}
