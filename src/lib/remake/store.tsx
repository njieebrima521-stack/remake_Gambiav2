import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { MATERIALS } from "./data";
import { errorMessage } from "./logic";
import type {
  AppRole,
  Batch,
  BatchDecision,
  MaterialId,
  MaterialRate,
  Me,
  Notice,
  Org,
  Pickup,
  PickupStatus,
  Profile,
  Payout,
  Redemption,
  RemakeState,
  Reward,
  ScanResult,
  Txn,
} from "./types";

const OFFLINE_KEY = "remake-collector-offline-v1";

type QueuedAction =
  | {
      kind: "weigh";
      pickupUuid: string;
      ref: string;
      kg: number;
      photoPath?: string | undefined;
      clientRequestId: string;
      at: string;
    }
  | {
      kind: "reject";
      pickupUuid: string;
      ref: string;
      reason: string;
      clientRequestId: string;
      at: string;
    };

interface OfflineState {
  offline: boolean;
  queue: QueuedAction[];
}

export interface BookInput {
  material: MaterialId;
  bags: number;
  date: string;
  slot: string;
  address: string;
  area: string;
  notes?: string | undefined;
  /** Set for recurring business pickups. */
  frequency?: "Weekly" | "Fortnightly" | "Monthly" | undefined;
  /** Same id for retries of one submission, so double clicks never create two pickups. */
  clientRequestId: string;
}

type RedeemResult = { ok: true; voucher: string } | { ok: false; error: string };

const defaultRates = Object.fromEntries(
  Object.values(MATERIALS).map((m) => [
    m.id,
    { id: m.id, pointsPerKg: m.pointsPerKg, active: true },
  ]),
) as Record<MaterialId, MaterialRate>;

const emptyProfile: Profile = {
  name: "",
  phone: "",
  address: "",
  area: "Kanifing",
  smsAlerts: true,
  language: "English",
  email: "",
  memberSince: "",
};

function emptyData(): Omit<RemakeState, "collectorOffline" | "authReady" | "loaded"> {
  return {
    wallet: { available: 0, pending: 0 },
    pickups: [],
    batches: [],
    transactions: [],
    redemptions: [],
    payouts: [],
    lastScan: null,
    demoPickupId: null,
    profile: emptyProfile,
    notifications: [],
    rates: defaultRates,
    rewards: [],
    processors: [],
    settings: { collectorRateGmdPerKg: 6, coinsPerGmd: 10 },
    me: null,
  };
}

const day = (ts: string | null | undefined) => (ts ? ts.slice(0, 10) : undefined);
const one = <T,>(v: T | T[] | null | undefined): T | undefined =>
  Array.isArray(v) ? v[0] : (v ?? undefined);
const num = (v: unknown) => (v === null || v === undefined ? undefined : Number(v));

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

async function loadData(uid: string, email: string) {
  const [
    prof,
    roles,
    reqs,
    mems,
    wallet,
    pickups,
    batches,
    txns,
    reds,
    notes,
    mats,
    rewards,
    orgs,
    settings,
    scan,
    payouts,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", uid),
    supabase.from("role_requests").select("role").eq("user_id", uid).eq("status", "pending"),
    supabase
      .from("organization_members")
      .select("organizations(id,name,kind,status,materials,address,area)")
      .eq("user_id", uid),
    supabase.from("wallets").select("available,pending").eq("user_id", uid).maybeSingle(),
    supabase
      .from("pickups")
      .select("*, collections(*)")
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase
      .from("batches")
      .select("*, batch_items(pickup_id), batch_verifications(*)")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("coin_transactions")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("redemptions")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false }),
    supabase
      .from("notifications")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("materials").select("id,points_per_kg,active"),
    supabase.from("rewards").select("*").order("cost"),
    supabase
      .from("organizations")
      .select("id,name,kind,status,materials")
      .eq("kind", "processor")
      .order("name"),
    supabase.from("platform_settings").select("key,value"),
    supabase
      .from("scans")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("payouts")
      .select("*")
      .eq("payee_user_id", uid)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const p = check(prof);
  const myOrgs: Org[] = (check(mems) ?? [])
    .map((m) => one(m.organizations as unknown as Org | Org[]))
    .filter((o): o is Org => !!o);
  const myOrgIds = new Set(myOrgs.map((o) => o.id));
  const me: Me = {
    id: uid,
    email,
    roles: (check(roles) ?? []).map((r) => r.role as AppRole),
    pendingRoles: (check(reqs) ?? []).map((r) => r.role as AppRole),
    orgs: myOrgs,
  };

  const batchRows = check(batches) ?? [];
  const batchRef = new Map(batchRows.map((b) => [b.id, b.ref]));
  const pickupRows = check(pickups) ?? [];
  const pickupRef = new Map(pickupRows.map((r) => [r.id, r.ref]));

  const mapped: Pickup[] = pickupRows.map((r) => {
    const c = one(
      r.collections as unknown as Record<string, unknown> | Record<string, unknown>[],
    ) as
      | {
          weight_kg: number | null;
          receipt_no: string | null;
          collected_at: string;
          reject_reason: string | null;
          photo_path: string | null;
          offline_recorded: boolean;
          payout_id: string | null;
        }
      | undefined;
    const resident = r.owner_type === "resident";
    return {
      uuid: r.id,
      id: r.ref,
      code: r.qr_code,
      ownerType: r.owner_type as Pickup["ownerType"],
      mine: resident && r.owner_id === uid,
      mineBusiness:
        !resident &&
        (r.owner_id === uid || (!!r.organization_id && myOrgIds.has(r.organization_id))),
      assignedToMe: r.collector_id === uid,
      collectorId: r.collector_id ?? undefined,
      customer: r.customer_name,
      phone: r.phone,
      address: r.address,
      area: r.area,
      material: r.material_id as MaterialId,
      bags: r.bags,
      date: r.preferred_date,
      slot: r.slot,
      notes: r.notes ?? undefined,
      status: r.status as PickupStatus,
      collector: r.collector_name ?? "Awaiting assignment",
      createdAt: day(r.created_at)!,
      weightKg: num(c?.weight_kg),
      receiptNo: c?.receipt_no ?? undefined,
      collectedAt: day(c?.collected_at),
      batchId: r.batch_id ? batchRef.get(r.batch_id) : undefined,
      acceptedKg: num(r.accepted_kg),
      pointsPending:
        resident && (r.status === "collected" || r.status === "batched")
          ? r.points_pending
          : undefined,
      pointsAwarded: r.points_awarded ?? undefined,
      recurring: !!r.frequency || undefined,
      frequency: (r.frequency as Pickup["frequency"]) ?? undefined,
      rejectReason: c?.reject_reason ?? undefined,
      photoTaken: !!c?.photo_path || undefined,
      payoutId: c?.payout_id ?? undefined,
    };
  });

  const mappedBatches: Batch[] = batchRows.map((b) => {
    const v = one(
      b.batch_verifications as unknown as Record<string, unknown> | Record<string, unknown>[],
    ) as
      | {
          accepted_kg: number;
          rejected_kg: number;
          grade: string;
          note: string | null;
          decision: string;
        }
      | undefined;
    const items = (b.batch_items as unknown as { pickup_id: string }[]) ?? [];
    return {
      uuid: b.id,
      id: b.ref,
      code: b.qr_code,
      material: b.material_id as MaterialId,
      pickupIds: items.map((i) => pickupRef.get(i.pickup_id)).filter((x): x is string => !!x),
      itemCount: items.length,
      totalKg: Number(b.total_kg),
      processor: b.processor_name,
      processorOrgId: b.processor_org_id,
      createdAt: day(b.created_at)!,
      status: b.status as Batch["status"],
      acceptedKg: num(v?.accepted_kg),
      rejectedKg: num(v?.rejected_kg),
      grade: v?.grade,
      inspectionNote: v?.note ?? undefined,
      decision: v?.decision as BatchDecision | undefined,
    };
  });

  const rates = { ...defaultRates };
  for (const m of check(mats) ?? []) {
    if (m.id in rates)
      rates[m.id as MaterialId] = {
        id: m.id as MaterialId,
        pointsPerKg: Number(m.points_per_kg),
        active: m.active,
      };
  }
  const setting = (k: string, d: number) =>
    Number((check(settings) ?? []).find((s) => s.key === k)?.value ?? d);
  const s = check(scan);
  const w = check(wallet);
  const mine = mapped.filter((x) => x.mine);

  return {
    wallet: { available: w?.available ?? 0, pending: w?.pending ?? 0 },
    pickups: mapped,
    batches: mappedBatches,
    transactions: (check(txns) ?? []).map<Txn>((t) => ({
      id: t.id,
      type: t.type as Txn["type"],
      amount: t.amount,
      label: t.label,
      date: day(t.created_at)!,
    })),
    redemptions: (check(reds) ?? []).map<Redemption>((r) => ({
      id: r.ref,
      uuid: r.id,
      rewardId: r.reward_id,
      name: r.name,
      cost: r.cost,
      date: day(r.created_at)!,
      voucher: r.voucher,
      status: r.status as Redemption["status"],
    })),
    payouts: (check(payouts) ?? []).map<Payout>((o) => ({
      uuid: o.id,
      id: o.ref,
      kind: o.kind as Payout["kind"],
      payeeName: o.payee_name,
      itemCount: o.item_count,
      quantity: Number(o.quantity),
      rate: num(o.rate),
      amountGmd: Number(o.amount_gmd),
      status: o.status as Payout["status"],
      method: o.method ?? undefined,
      reference: o.reference ?? undefined,
      note: o.note ?? undefined,
      createdAt: o.created_at,
      paidAt: o.paid_at ?? undefined,
    })),
    lastScan: s
      ? ({
          id: s.id,
          items: (s.items as unknown as ScanResult["items"]) ?? [],
          primaryMaterial: (s.primary_material as MaterialId | null) ?? null,
          accepted: s.accepted,
          contaminated: s.contaminated,
          estimatedKg: Number(s.estimated_kg),
          advice: s.advice ?? undefined,
          createdAt: day(s.created_at)!,
        } satisfies ScanResult)
      : null,
    demoPickupId: (mine[0] ?? mapped[0])?.id ?? null,
    profile: p
      ? {
          name: p.full_name,
          phone: p.phone,
          address: p.address,
          area: p.area,
          smsAlerts: p.sms_alerts,
          language: p.language as Profile["language"],
          email: p.email ?? email,
          memberSince: day(p.created_at)!,
        }
      : { ...emptyProfile, email },
    notifications: (check(notes) ?? []).map<Notice>((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      date: day(n.created_at)!,
      kind: n.kind as Notice["kind"],
      link: n.link ?? undefined,
      read: !!n.read_at,
    })),
    rates,
    rewards: (check(rewards) ?? []).map<Reward>((r) => ({
      id: r.id,
      name: r.name,
      partner: r.partner,
      category: r.category as Reward["category"],
      cost: r.cost,
      valueGmd: r.value_gmd,
      stock: r.stock,
      active: r.active,
    })),
    processors: (check(orgs) ?? []) as Org[],
    settings: {
      collectorRateGmdPerKg: setting("collector_rate_gmd_per_kg", 6),
      coinsPerGmd: setting("coins_per_gmd", 10),
    },
    me,
  };
}

async function rpc<T>(
  promise: PromiseLike<{ data: T; error: { message: string } | null }>,
): Promise<T> {
  const { data, error } = await promise;
  if (error) throw new Error(error.message);
  return data;
}

function readOffline(): OfflineState {
  try {
    const raw = window.localStorage.getItem(OFFLINE_KEY);
    if (raw) return JSON.parse(raw) as OfflineState;
  } catch {
    /* ignore */
  }
  return { offline: false, queue: [] };
}

interface Ctx {
  state: RemakeState;
  refresh: () => Promise<void>;
  bookPickup: (input: BookInput) => Promise<string>;
  verifyPickupCode: (ref: string, code: string) => Promise<void>;
  uploadCollectionPhoto: (file: File) => Promise<string>;
  recordWeight: (ref: string, kg: number, photoPath?: string) => Promise<void>;
  rejectPickup: (ref: string, reason: string) => Promise<void>;
  createBatch: (pickupRefs: string[], processorOrgId: string) => Promise<string>;
  handOverBatch: (batchRef: string) => Promise<void>;
  verifyBatch: (
    batchRef: string,
    actualKg: number,
    rejectedKg: number,
    grade: string,
    note?: string,
  ) => Promise<void>;
  lookupBatchCode: (code: string) => Promise<string>;
  redeem: (reward: Reward, clientRequestId: string) => Promise<RedeemResult>;
  /** Collector asks for their unpaid collections to be paid out; returns the payout ref. */
  requestPayout: () => Promise<string>;
  setOffline: (offline: boolean) => void;
  sync: () => Promise<number>;
  markNotificationsRead: (ids: string[] | null) => Promise<void>;
  updateProfile: (p: Omit<Profile, "email" | "memberSince">) => Promise<void>;
  signOut: () => Promise<void>;
  hasRole: (r: AppRole) => boolean;
}

const RemakeContext = createContext<Ctx | null>(null);

export function RemakeProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [session, setSession] = useState<{ uid: string; email: string } | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [offline, setOfflineState] = useState<OfflineState>({ offline: false, queue: [] });

  useEffect(() => {
    setOfflineState(readOffline());
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession((prev) =>
        s ? (prev?.uid === s.user.id ? prev : { uid: s.user.id, email: s.user.email ?? "" }) : null,
      );
      setAuthReady(true);
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED")
        void router.invalidate();
    });
    void supabase.auth.getSession().then(({ data }) => {
      const s = data.session;
      setSession((prev) =>
        s ? (prev?.uid === s.user.id ? prev : { uid: s.user.id, email: s.user.email ?? "" }) : null,
      );
      setAuthReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  const uid = session?.uid ?? null;
  const queryKey = useMemo(() => ["remake", uid] as const, [uid]);
  const query = useQuery({
    queryKey,
    queryFn: () => loadData(uid!, session?.email ?? ""),
    enabled: !!uid,
    refetchInterval: 30_000,
    staleTime: 3_000,
  });

  // Live updates: every workflow step writes a notification for the people it affects.
  useEffect(() => {
    if (!uid) return;
    const channel = supabase
      .channel(`notifications-${uid}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["remake", uid] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [uid, queryClient]);

  const saveOffline = useCallback((next: OfflineState) => {
    setOfflineState(next);
    try {
      window.localStorage.setItem(OFFLINE_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable */
    }
  }, []);

  const state = useMemo<RemakeState>(() => {
    const base = query.data ?? emptyData();
    let pickups = base.pickups;
    if (offline.queue.length) {
      const q = new Map(offline.queue.map((a) => [a.pickupUuid, a]));
      pickups = pickups.map((p) => {
        const a = q.get(p.uuid);
        if (!a || p.status !== "scheduled") return p;
        return a.kind === "weigh"
          ? {
              ...p,
              status: "collected" as const,
              weightKg: a.kg,
              collectedAt: a.at.slice(0, 10),
              unsynced: true,
              receiptNo: "Pending sync",
            }
          : {
              ...p,
              status: "rejected" as const,
              rejectReason: a.reason,
              collectedAt: a.at.slice(0, 10),
              unsynced: true,
            };
      });
    }
    return {
      ...base,
      pickups,
      collectorOffline: offline.offline,
      authReady,
      loaded: !uid || query.isSuccess,
    };
  }, [query.data, query.isSuccess, offline, authReady, uid]);

  const value = useMemo<Ctx>(() => {
    const refresh = async () => {
      await queryClient.invalidateQueries({ queryKey: ["remake", uid] });
    };
    const find = (ref: string) => {
      const p = state.pickups.find((x) => x.id === ref);
      if (!p) throw new Error(`Pickup ${ref} not found.`);
      return p;
    };
    const findBatch = (ref: string) => {
      const b = state.batches.find((x) => x.id === ref);
      if (!b) throw new Error(`Batch ${ref} not found.`);
      return b;
    };
    const after = async <T,>(fn: () => Promise<T>) => {
      const out = await fn();
      await refresh();
      return out;
    };

    return {
      state,
      refresh,
      hasRole: (r) => !!state.me?.roles.includes(r),
      bookPickup: (input) =>
        after(async () => {
          const row = await rpc(
            supabase.rpc("book_pickup", {
              _material: input.material,
              _bags: input.bags,
              _date: input.date,
              _slot: input.slot,
              _address: input.address,
              _area: input.area,
              _notes: input.notes ?? "",
              _client_request_id: input.clientRequestId,
              ...(input.frequency ? { _frequency: input.frequency } : {}),
            }),
          );
          return (row as { ref: string }).ref;
        }),
      verifyPickupCode: async (ref, code) => {
        await rpc(supabase.rpc("verify_pickup_code", { _pickup: find(ref).uuid, _code: code }));
      },
      uploadCollectionPhoto: async (file) => {
        if (!uid) throw new Error("You need to sign in first.");
        if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
        if (file.size > 8 * 1024 * 1024) throw new Error("Photo must be under 8 MB.");
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
        const path = `${uid}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from("collection-photos")
          .upload(path, file, { contentType: file.type });
        if (error) throw new Error(error.message);
        return path;
      },
      recordWeight: async (ref, kg, photoPath) => {
        const p = find(ref);
        const clientRequestId = crypto.randomUUID();
        if (offline.offline) {
          saveOffline({
            ...offline,
            queue: [
              ...offline.queue.filter((a) => a.pickupUuid !== p.uuid),
              {
                kind: "weigh",
                pickupUuid: p.uuid,
                ref,
                kg,
                photoPath,
                clientRequestId,
                at: new Date().toISOString(),
              },
            ],
          });
          return;
        }
        await after(() =>
          rpc(
            supabase.rpc("record_collection", {
              _pickup: p.uuid,
              _weight: kg,
              _photo_path: (photoPath ?? null) as unknown as string,
              _offline: false,
              _client_request_id: clientRequestId,
            }),
          ),
        );
      },
      rejectPickup: async (ref, reason) => {
        const p = find(ref);
        const clientRequestId = crypto.randomUUID();
        if (offline.offline) {
          saveOffline({
            ...offline,
            queue: [
              ...offline.queue.filter((a) => a.pickupUuid !== p.uuid),
              {
                kind: "reject",
                pickupUuid: p.uuid,
                ref,
                reason,
                clientRequestId,
                at: new Date().toISOString(),
              },
            ],
          });
          return;
        }
        await after(() =>
          rpc(
            supabase.rpc("reject_pickup", {
              _pickup: p.uuid,
              _reason: reason,
              _offline: false,
              _client_request_id: clientRequestId,
            }),
          ),
        );
      },
      createBatch: (refs, processorOrgId) =>
        after(async () => {
          const ids = refs.map((r) => find(r).uuid);
          const row = await rpc(
            supabase.rpc("create_batch", { _pickup_ids: ids, _processor_org: processorOrgId }),
          );
          return (row as { ref: string }).ref;
        }),
      handOverBatch: (ref) =>
        after(async () => {
          await rpc(supabase.rpc("hand_over_batch", { _batch: findBatch(ref).uuid }));
        }),
      verifyBatch: (ref, actual, rejected, grade, note) =>
        after(async () => {
          await rpc(
            supabase.rpc("verify_batch", {
              _batch: findBatch(ref).uuid,
              _actual: actual,
              _rejected: rejected,
              _grade: grade,
              _note: note ?? "",
            }),
          );
        }),
      lookupBatchCode: async (code) =>
        (await rpc(supabase.rpc("lookup_batch_code", { _code: code }))) as string,
      redeem: async (reward, clientRequestId) => {
        try {
          const row = await after(() =>
            rpc(
              supabase.rpc("redeem_reward", {
                _reward: reward.id,
                _client_request_id: clientRequestId,
              }),
            ),
          );
          return { ok: true, voucher: (row as { voucher: string }).voucher };
        } catch (e) {
          return { ok: false, error: errorMessage(e) };
        }
      },
      requestPayout: () =>
        after(async () => {
          const row = await rpc(supabase.rpc("request_collector_payout"));
          return (row as { ref: string }).ref;
        }),
      setOffline: (o) => saveOffline({ ...offline, offline: o }),
      sync: async () => {
        const queue = [...offline.queue];
        let done = 0;
        const remaining: QueuedAction[] = [];
        for (const a of queue) {
          try {
            if (a.kind === "weigh") {
              await rpc(
                supabase.rpc("record_collection", {
                  _pickup: a.pickupUuid,
                  _weight: a.kg,
                  _photo_path: (a.photoPath ?? null) as unknown as string,
                  _offline: true,
                  _client_request_id: a.clientRequestId,
                }),
              );
            } else {
              await rpc(
                supabase.rpc("reject_pickup", {
                  _pickup: a.pickupUuid,
                  _reason: a.reason,
                  _offline: true,
                  _client_request_id: a.clientRequestId,
                }),
              );
            }
            done++;
          } catch (e) {
            const msg = errorMessage(e);
            // Already recorded elsewhere: drop it; anything else stays queued for the next sync.
            if (!/already been recorded|not assigned/i.test(msg)) remaining.push(a);
          }
        }
        saveOffline({ offline: false, queue: remaining });
        await refresh();
        if (remaining.length)
          throw new Error(
            `${remaining.length} record(s) could not sync yet. Try again when the connection is better.`,
          );
        return done;
      },
      markNotificationsRead: (ids) =>
        after(async () => {
          await rpc(supabase.rpc("mark_notifications_read", ids ? { _ids: ids } : {}));
        }),
      updateProfile: (p) =>
        after(async () => {
          await rpc(
            supabase.rpc("update_my_profile", {
              _full_name: p.name,
              _phone: p.phone,
              _address: p.address,
              _area: p.area,
              _language: p.language,
              _sms_alerts: p.smsAlerts,
            }),
          );
        }),
      signOut: async () => {
        await queryClient.cancelQueries();
        queryClient.clear();
        await supabase.auth.signOut();
      },
    };
  }, [state, uid, queryClient, offline, saveOffline]);

  return <RemakeContext.Provider value={value}>{children}</RemakeContext.Provider>;
}

export function useRemake() {
  const ctx = useContext(RemakeContext);
  if (!ctx) throw new Error("useRemake must be used inside RemakeProvider");
  return ctx;
}
