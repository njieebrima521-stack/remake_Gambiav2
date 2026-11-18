export type MaterialId = "plastic" | "metal" | "glass" | "paper" | "ewaste" | "organic";

export type PickupStatus = "scheduled" | "collected" | "batched" | "verified" | "rejected";

export type AppRole = "resident" | "business" | "collector" | "hub" | "processor" | "admin";

export interface Pickup {
  /** Database id (used for backend calls). */
  uuid: string;
  /** Human reference, e.g. PU-1001 (used in URLs and on screen). */
  id: string;
  /** Value encoded in the pickup QR code. */
  code: string;
  ownerType: "resident" | "business";
  /** Resident pickup belonging to the signed-in user. */
  mine: boolean;
  /** Business pickup belonging to the signed-in user or their business. */
  mineBusiness: boolean;
  /** Assigned to the signed-in collector. */
  assignedToMe: boolean;
  collectorId?: string | undefined;
  customer: string;
  phone: string;
  address: string;
  area: string;
  material: MaterialId;
  bags: number;
  date: string; // yyyy-mm-dd
  slot: string;
  notes?: string | undefined;
  status: PickupStatus;
  collector: string;
  createdAt: string;
  weightKg?: number | undefined;
  receiptNo?: string | undefined;
  collectedAt?: string | undefined;
  batchId?: string | undefined;
  acceptedKg?: number | undefined;
  pointsPending?: number | undefined;
  pointsAwarded?: number | undefined;
  recurring?: boolean | undefined;
  frequency?: "Weekly" | "Fortnightly" | "Monthly" | undefined;
  rejectReason?: string | undefined;
  /** Collector recorded this while offline; not yet synced. */
  unsynced?: boolean | undefined;
  photoTaken?: boolean | undefined;
  /** Collector payout this collection belongs to (unset = not yet paid out). */
  payoutId?: string | undefined;
  /** Fine-grained material type when booked via stream booking. */
  materialType?: string | undefined;
  /** Exact coordinates saved on the pickup at booking time. */
  lat?: number | undefined;
  lng?: number | undefined;
  locationSource?: "gps" | "pin" | "manual" | "saved" | "geocode" | "area" | undefined;
}

export type BatchStatus = "ready" | "in_transit" | "verified";

export interface Batch {
  uuid: string;
  id: string;
  code: string;
  material: MaterialId;
  pickupIds: string[];
  /** Number of loads in the batch (visible even when the loads themselves are not). */
  itemCount: number;
  totalKg: number;
  processor: string;
  processorOrgId: string;
  createdAt: string;
  status: BatchStatus;
  acceptedKg?: number | undefined;
  rejectedKg?: number | undefined;
  grade?: string | undefined;
  inspectionNote?: string | undefined;
  decision?: BatchDecision | undefined;
}

export type BatchDecision = "accepted" | "partial" | "rejected";

export type TxnType = "earned" | "pending" | "redeemed" | "forfeited";

export interface Txn {
  id: string;
  type: TxnType;
  amount: number;
  label: string;
  date: string;
}

export interface Reward {
  id: string;
  name: string;
  partner: string;
  category: "Airtime & Data" | "Household" | "Food" | "Education" | "Services";
  cost: number;
  valueGmd: number;
  stock: number;
  active: boolean;
}

export interface Redemption {
  id: string;
  uuid: string;
  rewardId: string;
  name: string;
  cost: number;
  date: string;
  voucher: string;
  status: "Issued" | "Delivered" | "Cancelled";
}

export interface ScanItem {
  label: string;
  material: MaterialId | "other";
  count: number;
  confidence: number;
}

export interface ScanResult {
  id: string;
  items: ScanItem[];
  primaryMaterial: MaterialId | null;
  accepted: boolean;
  contaminated: boolean;
  estimatedKg: number;
  advice?: string | undefined;
  createdAt: string;
}

export type PayoutStatus = "pending" | "paid" | "cancelled";

export interface Payout {
  uuid: string;
  /** Human reference, e.g. PO-501. */
  id: string;
  kind: "collector" | "partner";
  payeeName: string;
  itemCount: number;
  /** Kilograms for collector payouts, vouchers for partner payouts. */
  quantity: number;
  /** GMD per kg locked when a collector payout was created. */
  rate?: number | undefined;
  amountGmd: number;
  status: PayoutStatus;
  method?: string | undefined;
  reference?: string | undefined;
  note?: string | undefined;
  createdAt: string;
  paidAt?: string | undefined;
}

export interface MaterialRate {
  id: MaterialId;
  pointsPerKg: number;
  active: boolean;
}

export interface Notice {
  id: string;
  title: string;
  body: string;
  date: string;
  kind: "pickup" | "coins" | "reward" | "tip" | "batch" | "account";
  link?: string | undefined;
  read: boolean;
}

export interface Org {
  id: string;
  name: string;
  kind: "business" | "hub" | "processor";
  status: string;
  materials: string[];
  address?: string | undefined;
  area?: string | undefined;
}

export interface Profile {
  name: string;
  phone: string;
  address: string;
  area: string;
  smsAlerts: boolean;
  language: "English" | "Wolof" | "Mandinka";
  email: string;
  memberSince: string;
}

export interface Me {
  id: string;
  email: string;
  roles: AppRole[];
  pendingRoles: AppRole[];
  orgs: Org[];
}

export interface RemakeState {
  wallet: { available: number; pending: number };
  pickups: Pickup[];
  batches: Batch[];
  transactions: Txn[];
  redemptions: Redemption[];
  /** Payouts to the signed-in collector. */
  payouts: Payout[];
  lastScan: ScanResult | null;
  /** The pickup the workflow tracker follows end-to-end. */
  demoPickupId: string | null;
  collectorOffline: boolean;
  profile: Profile;
  notifications: Notice[];
  rates: Record<MaterialId, MaterialRate>;
  rewards: Reward[];
  processors: Org[];
  settings: { collectorRateGmdPerKg: number; coinsPerGmd: number };
  me: Me | null;
  /** Auth session checked. */
  authReady: boolean;
  /** First data load finished for the signed-in user. */
  loaded: boolean;
}
