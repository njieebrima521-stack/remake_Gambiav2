import { db, rpc, rows } from "./db";
import type { MaterialTypeId } from "../material-types";

export type ApprovalStatus = "pending" | "approved" | "rejected" | "suspended";
export type OperatingStatus = "accepting" | "paused" | "closed";

export interface Specialisation {
  orgId: string;
  materialType: MaterialTypeId;
  status: ApprovalStatus;
  note: string | null;
  decidedAt: string | null;
}

export interface Institution {
  id: string;
  name: string;
  /** "hub" = collection/recycling hub (collectors belong here), "processor" = verifies batches. */
  kind: "hub" | "processor";
  status: "active" | "onboarding" | "suspended";
  phone: string;
  address: string;
  area: string;
  serviceAreas: string[];
  operatingStatus: OperatingStatus;
  /** Max pickups per day; null = not limited. */
  dailyCapacity: number | null;
  lat: number | null;
  lng: number | null;
  specialisations: Specialisation[];
  createdAt: string;
}

export type MembershipStatus =
  "requested" | "invited" | "approved" | "suspended" | "removed" | "declined";

export interface CollectorMembership {
  id: string;
  orgId: string;
  orgName: string;
  collectorId: string;
  collectorName: string;
  collectorPhone: string;
  status: MembershipStatus;
  /** Material types explicitly excluded for this collector. */
  restrictions: MaterialTypeId[];
  /** Effective permissions: institution's approved specialisations minus restrictions (computed on the server). */
  permissions: MaterialTypeId[];
  createdAt: string;
  decidedAt: string | null;
}

type OrgRow = {
  id: string;
  name: string;
  kind: "hub" | "processor";
  status: Institution["status"];
  phone: string;
  address: string;
  area: string;
  service_areas: string[] | null;
  operating_status: OperatingStatus | null;
  daily_capacity: number | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
  institution_specialisations?: {
    org_id: string;
    material_type: MaterialTypeId;
    status: ApprovalStatus;
    note: string | null;
    decided_at: string | null;
  }[];
};

const mapOrg = (r: OrgRow): Institution => ({
  id: r.id,
  name: r.name,
  kind: r.kind,
  status: r.status,
  phone: r.phone,
  address: r.address,
  area: r.area,
  serviceAreas: r.service_areas ?? [],
  operatingStatus: r.operating_status ?? "accepting",
  dailyCapacity: r.daily_capacity,
  lat: r.lat,
  lng: r.lng,
  createdAt: r.created_at,
  specialisations: (r.institution_specialisations ?? []).map((s) => ({
    orgId: s.org_id,
    materialType: s.material_type,
    status: s.status,
    note: s.note,
    decidedAt: s.decided_at,
  })),
});

/** Hubs and processors visible to the signed-in user, with their specialisations. */
export async function listInstitutions(): Promise<Institution[]> {
  const data = await rows<OrgRow>(
    db
      .from("organizations")
      .select("*, institution_specialisations(org_id, material_type, status, note, decided_at)")
      .in("kind", ["hub", "processor"])
      .order("name"),
  );
  return data.map(mapOrg);
}

/** Register a new institution (starts in onboarding with pending specialisations). */
export async function registerInstitution(input: {
  name: string;
  kind: "hub" | "processor";
  phone: string;
  address: string;
  area: string;
  serviceAreas: string[];
  dailyCapacity: number | null;
  materialTypes: MaterialTypeId[];
}): Promise<string> {
  return rpc<string>("register_institution", {
    _name: input.name,
    _kind: input.kind,
    _phone: input.phone,
    _address: input.address,
    _area: input.area,
    _service_areas: input.serviceAreas,
    _daily_capacity: input.dailyCapacity,
    _material_types: input.materialTypes,
  });
}

/** Institution manager (or admin) updates settings. Material additions become pending requests. */
export async function updateInstitutionSettings(
  orgId: string,
  input: {
    phone: string;
    address: string;
    area: string;
    serviceAreas: string[];
    operatingStatus: OperatingStatus;
    dailyCapacity: number | null;
    requestMaterialTypes: MaterialTypeId[];
  },
): Promise<void> {
  await rpc("update_institution_settings", {
    _org: orgId,
    _phone: input.phone,
    _address: input.address,
    _area: input.area,
    _service_areas: input.serviceAreas,
    _operating_status: input.operatingStatus,
    _daily_capacity: input.dailyCapacity,
    _request_material_types: input.requestMaterialTypes,
  });
}

/** Admin: approve / reject / suspend one specialisation. */
export async function decideSpecialisation(
  orgId: string,
  materialType: MaterialTypeId,
  status: Exclude<ApprovalStatus, "pending">,
  note: string,
): Promise<void> {
  await rpc("admin_decide_specialisation", {
    _org: orgId,
    _material_type: materialType,
    _status: status,
    _note: note,
  });
}

/** Admin: verify/suspend an institution as a whole. */
export async function setInstitutionStatus(
  orgId: string,
  status: Institution["status"],
): Promise<void> {
  await rpc("admin_set_org_status", { _org: orgId, _status: status });
}

type MemRow = {
  id: string;
  org_id: string;
  org_name: string;
  collector_id: string;
  collector_name: string;
  collector_phone: string;
  status: MembershipStatus;
  restrictions: MaterialTypeId[] | null;
  permissions: MaterialTypeId[] | null;
  created_at: string;
  decided_at: string | null;
};
const mapMem = (r: MemRow): CollectorMembership => ({
  id: r.id,
  orgId: r.org_id,
  orgName: r.org_name,
  collectorId: r.collector_id,
  collectorName: r.collector_name,
  collectorPhone: r.collector_phone,
  status: r.status,
  restrictions: r.restrictions ?? [],
  permissions: r.permissions ?? [],
  createdAt: r.created_at,
  decidedAt: r.decided_at,
});

/** Memberships visible to the caller: a collector sees their own; managers see their institution's; admins see all. */
export async function listMemberships(orgId?: string): Promise<CollectorMembership[]> {
  const data = await rpc<MemRow[]>("list_collector_memberships", { _org: orgId ?? null });
  return data.map(mapMem);
}

/** Collector asks to join an institution. */
export async function requestMembership(orgId: string): Promise<void> {
  await rpc("request_collector_membership", { _org: orgId });
}

/** Collector accepts or declines an invitation. */
export async function respondToInvitation(membershipId: string, accept: boolean): Promise<void> {
  await rpc("respond_collector_invitation", { _membership: membershipId, _accept: accept });
}

/** Institution manager invites a collector by phone or email. */
export async function inviteCollector(orgId: string, contact: string): Promise<void> {
  await rpc("invite_collector", { _org: orgId, _contact: contact });
}

/** Institution manager/admin: approve, suspend, remove a membership. */
export async function setMembershipStatus(
  membershipId: string,
  status: "approved" | "suspended" | "removed" | "declined",
): Promise<void> {
  await rpc("set_collector_membership_status", { _membership: membershipId, _status: status });
}

/** Institution manager/admin: exclude material types for one collector (can only narrow permissions). */
export async function setMembershipRestrictions(
  membershipId: string,
  restrictions: MaterialTypeId[],
): Promise<void> {
  await rpc("set_collector_restrictions", {
    _membership: membershipId,
    _restrictions: restrictions,
  });
}
