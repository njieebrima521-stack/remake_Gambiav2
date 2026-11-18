import type { Database } from "./types";

type Row = Record<string, unknown>;

interface MockSession {
  access_token: string;
  user: {
    id: string;
    email: string;
    user_metadata: Record<string, unknown>;
  };
}

interface MockDb {
  seq: { pickup: number; batch: number; receipt: number; redemption: number; payout: number };
  profiles: Row[];
  user_roles: Row[];
  role_requests: Row[];
  organizations: Row[];
  organization_members: Row[];
  wallets: Row[];
  materials: Row[];
  rewards: Row[];
  platform_settings: Row[];
  pickups: Row[];
  collections: Row[];
  pickup_locations: Row[];
  batches: Row[];
  batch_items: Row[];
  batch_verifications: Row[];
  coin_transactions: Row[];
  redemptions: Row[];
  notifications: Row[];
  scans: Row[];
  payouts: Row[];
  activity_log: Row[];
  saved_locations: Row[];
}

const DB_KEY = "remake-mock-db-v1";
const AUTH_KEY = "remake-mock-auth-v1";

const COLLECTOR_DEMO_ID = "00000000-0000-4000-8000-000000000002";
const RESIDENT_DEMO_ID = "00000000-0000-4000-8000-000000000001";
const BUSINESS_ORG_ID = "10000000-0000-4000-8000-000000000005";
const HUB_ORG_ID = "10000000-0000-4000-8000-000000000001";
const PROC_POLYMER_ID = "10000000-0000-4000-8000-000000000002";
const PROC_METAL_ID = "10000000-0000-4000-8000-000000000003";
const PROC_COMPOST_ID = "10000000-0000-4000-8000-000000000004";

function isoDayOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function nowIso(): string {
  return new Date().toISOString();
}

function createSeedDb(): MockDb {
  return {
    seq: { pickup: 1001, batch: 301, receipt: 88001, redemption: 201, payout: 501 },
    profiles: [],
    user_roles: [],
    role_requests: [],
    organizations: [],
    organization_members: [],
    wallets: [],
    materials: [
      {
        id: "plastic",
        name: "Plastics",
        examples: "Bottles, buckets, chairs, cups",
        points_per_kg: 15,
        active: true,
        sort: 1,
      },
      {
        id: "metal",
        name: "Metals",
        examples: "Cans, tables, gas containers",
        points_per_kg: 20,
        active: true,
        sort: 2,
      },
      {
        id: "glass",
        name: "Glass",
        examples: "Bottles, jars, mirrors",
        points_per_kg: 8,
        active: true,
        sort: 3,
      },
      {
        id: "paper",
        name: "Paper & Cardboard",
        examples: "Boxes, newspapers, exercise books",
        points_per_kg: 10,
        active: true,
        sort: 4,
      },
      {
        id: "ewaste",
        name: "Electronic Waste",
        examples: "Phones, chargers, cables, radios",
        points_per_kg: 30,
        active: true,
        sort: 5,
      },
      {
        id: "organic",
        name: "Organic Waste",
        examples: "Food scraps, peels, garden waste",
        points_per_kg: 5,
        active: true,
        sort: 6,
      },
    ],
    rewards: [],
    platform_settings: [
      { key: "collector_rate_gmd_per_kg", value: 6, label: "Collector pay per kg (GMD)" },
      { key: "coins_per_gmd", value: 10, label: "Green Coins per GMD 1" },
    ],
    pickups: [],
    collections: [],
    pickup_locations: [],
    batches: [],
    batch_items: [],
    batch_verifications: [],
    coin_transactions: [],
    redemptions: [],
    notifications: [],
    scans: [],
    payouts: [],
    activity_log: [],
    saved_locations: [],
  };
}

let memoryDb: MockDb | null = null;
let memorySession: MockSession | null = null;
const authListeners = new Set<(event: string, session: MockSession | null) => void>();

function loadDb(): MockDb {
  if (typeof window === "undefined") {
    memoryDb ??= createSeedDb();
    return memoryDb;
  }
  try {
    const raw = window.localStorage.getItem(DB_KEY);
    if (raw) {
      memoryDb = JSON.parse(raw) as MockDb;
      return memoryDb;
    }
  } catch {
    /* ignore storage errors */
  }
  memoryDb = createSeedDb();
  saveDb(memoryDb);
  return memoryDb;
}

function saveDb(db: MockDb): void {
  memoryDb = db;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(DB_KEY, JSON.stringify(db));
    } catch {
      /* ignore quota errors */
    }
  }
}

function loadSession(): MockSession | null {
  if (typeof window === "undefined") return memorySession;
  try {
    const raw = window.localStorage.getItem(AUTH_KEY);
    if (raw) {
      memorySession = JSON.parse(raw) as MockSession;
      return memorySession;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function saveSession(session: MockSession | null): void {
  memorySession = session;
  if (typeof window !== "undefined") {
    try {
      if (session) window.localStorage.setItem(AUTH_KEY, JSON.stringify(session));
      else window.localStorage.removeItem(AUTH_KEY);
    } catch {
      /* ignore */
    }
  }
}

function emitAuth(event: string, session: MockSession | null): void {
  for (const cb of authListeners) {
    try {
      cb(event, session);
    } catch {
      /* ignore listener errors */
    }
  }
}

function activeUid(): string | null {
  return loadSession()?.user.id ?? null;
}

function enrichRow(db: MockDb, table: string, row: Row): Row {
  const out = { ...row };
  if (table === "pickups") {
    out["collections"] = db.collections.filter((c) => c["pickup_id"] === row["id"]);
    out["pickup_locations"] = db.pickup_locations.filter((l) => l["pickup_id"] === row["id"]);
  } else if (table === "batches") {
    out["batch_items"] = db.batch_items.filter((i) => i["batch_id"] === row["id"]);
    out["batch_verifications"] = db.batch_verifications.filter((v) => v["batch_id"] === row["id"]);
  } else if (table === "organization_members") {
    out["organizations"] = db.organizations.find((o) => o["id"] === row["org_id"]) ?? null;
  }
  return out;
}

function createQueryBuilder(table: string) {
  let op: "select" | "insert" | "update" | "delete" = "select";
  let payload: Row | Row[] | null = null;
  const filters: ((r: Row) => boolean)[] = [];
  const orders: { col: string; asc: boolean }[] = [];
  let maxRows: number | null = null;
  let singleMode: "single" | "maybe" | null = null;

  const exec = (): { data: unknown; error: { message: string; code?: string } | null } => {
    const db = loadDb();
    const list = (db as unknown as Record<string, Row[]>)[table];
    if (!Array.isArray(list)) {
      return { data: singleMode ? null : [], error: null };
    }

    if (op === "insert") {
      const items = (Array.isArray(payload) ? payload : payload ? [payload] : []).map((item) => ({
        id: item["id"] ?? crypto.randomUUID(),
        created_at: item["created_at"] ?? nowIso(),
        ...item,
      }));
      list.push(...items);
      saveDb(db);
      const out = items.map((r) => enrichRow(db, table, r));
      if (singleMode) return { data: out[0] ?? null, error: null };
      return { data: out, error: null };
    }

    if (op === "update") {
      const updated: Row[] = [];
      for (const r of list) {
        if (filters.every((f) => f(r))) {
          Object.assign(r, payload);
          updated.push(enrichRow(db, table, r));
        }
      }
      saveDb(db);
      return { data: singleMode ? (updated[0] ?? null) : updated, error: null };
    }

    if (op === "delete") {
      const kept = list.filter((r) => !filters.every((f) => f(r)));
      (db as unknown as Record<string, Row[]>)[table] = kept;
      saveDb(db);
      return { data: [], error: null };
    }

    let result = list.filter((r) => filters.every((f) => f(r))).map((r) => enrichRow(db, table, r));
    if (orders.length > 0) {
      result = [...result].sort((a, b) => {
        for (const o of orders) {
          const av = a[o.col];
          const bv = b[o.col];
          if (av === bv) continue;
          if (av === null || av === undefined) return 1;
          if (bv === null || bv === undefined) return -1;
          const cmp = av < bv ? -1 : 1;
          return o.asc ? cmp : -cmp;
        }
        return 0;
      });
    }
    if (maxRows !== null) result = result.slice(0, maxRows);
    if (singleMode === "single") {
      if (!result[0]) return { data: null, error: { message: "Row not found", code: "PGRST116" } };
      return { data: result[0], error: null };
    }
    if (singleMode === "maybe") {
      return { data: result[0] ?? null, error: null };
    }
    return { data: result, error: null };
  };

  const builder = {
    select: (_cols?: string) => builder,
    insert: (rows: Row | Row[]) => {
      op = "insert";
      payload = rows;
      return builder;
    },
    update: (patch: Row) => {
      op = "update";
      payload = patch;
      return builder;
    },
    delete: () => {
      op = "delete";
      return builder;
    },
    eq: (col: string, val: unknown) => {
      filters.push((r) => r[col] === val);
      return builder;
    },
    in: (col: string, vals: unknown[]) => {
      filters.push((r) => vals.includes(r[col]));
      return builder;
    },
    like: (col: string, pattern: string) => {
      const prefix = pattern.replace(/%$/, "");
      filters.push((r) => String(r[col] ?? "").startsWith(prefix));
      return builder;
    },
    contains: (col: string, vals: unknown[]) => {
      filters.push((r) => {
        const cur = r[col];
        return Array.isArray(cur) && vals.every((v) => cur.includes(v));
      });
      return builder;
    },
    order: (col: string, opts?: { ascending?: boolean }) => {
      orders.push({ col, asc: opts?.ascending ?? true });
      return builder;
    },
    limit: (n: number) => {
      maxRows = n;
      return builder;
    },
    single: () => {
      singleMode = "single";
      return builder;
    },
    maybeSingle: () => {
      singleMode = "maybe";
      return builder;
    },
    then: <TResult1 = ReturnType<typeof exec>, TResult2 = never>(
      onfulfilled?: ((value: ReturnType<typeof exec>) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) => Promise.resolve(exec()).then(onfulfilled, onrejected),
  };

  return builder;
}

function handleRpc(
  fn: string,
  args: Row = {},
  overrideUid?: string,
): { data: unknown; error: { message: string; code?: string } | null } {
  const db = loadDb();
  const uid = overrideUid ?? activeUid();
  const fail = (message: string) => ({ data: null, error: { message } });
  const ok = (data: unknown) => {
    saveDb(db);
    return { data, error: null };
  };
  const notify = (userId: unknown, kind: string, title: string, body: string, link?: string) => {
    if (!userId) return;
    db.notifications.unshift({
      id: crypto.randomUUID(),
      user_id: userId,
      kind,
      title,
      body,
      link: link ?? null,
      read_at: null,
      created_at: nowIso(),
    });
  };
  const log = (action: string, entity: string, entityId: string, details: Row = {}) => {
    db.activity_log.unshift({
      id: Date.now() + Math.floor(Math.random() * 1000),
      actor_id: uid,
      action,
      entity,
      entity_id: entityId,
      details,
      created_at: nowIso(),
    });
  };

  if (!uid) return fail("You need to sign in first.");
  const meProfile = db.profiles.find((p) => p["id"] === uid);

  switch (fn) {
    case "book_pickup": {
      const materialId = String(args["_material"] ?? "plastic");
      const mat = db.materials.find((m) => m["id"] === materialId);
      if (!mat || !mat["active"]) return fail("This material is not currently collected.");
      const refNum = db.seq.pickup++;
      const ref = `PU-${refNum}`;
      const isBusiness = meProfile?.["account_type"] === "business" || !!args["_frequency"];
      const bizMem = db.organization_members.find((m) => m["user_id"] === uid);
      const bizOrg = bizMem
        ? db.organizations.find((o) => o["id"] === bizMem["org_id"] && o["kind"] === "business")
        : undefined;
      const collector = db.profiles.find((p) =>
        db.user_roles.some((r) => r["user_id"] === p["id"] && r["role"] === "collector"),
      );
      const pickup: Row = {
        id: crypto.randomUUID(),
        ref,
        qr_code: `RMK-${ref}`,
        owner_id: uid,
        owner_type: isBusiness ? "business" : "resident",
        organization_id: isBusiness ? (bizOrg?.["id"] ?? null) : null,
        customer_name: String(bizOrg?.["name"] ?? meProfile?.["full_name"] ?? "Resident"),
        phone: String(meProfile?.["phone"] ?? ""),
        address: String(args["_address"] ?? meProfile?.["address"] ?? ""),
        area: String(args["_area"] ?? meProfile?.["area"] ?? "Kanifing"),
        material_id: materialId,
        bags: Number(args["_bags"] ?? 1),
        preferred_date: String(args["_date"] ?? isoDayOffset(1)),
        slot: String(args["_slot"] ?? "09:00 – 11:00"),
        notes: args["_notes"] ? String(args["_notes"]) : null,
        status: "scheduled",
        collector_id: collector?.["id"] ?? COLLECTOR_DEMO_ID,
        collector_name: collector?.["full_name"] ?? "Lamin Ceesay",
        frequency: args["_frequency"] ? String(args["_frequency"]) : null,
        points_pending: 0,
        points_awarded: null,
        accepted_kg: null,
        batch_id: null,
        created_at: nowIso(),
        updated_at: nowIso(),
      };
      db.pickups.unshift(pickup);
      notify(
        uid,
        "pickup",
        `Pickup ${ref} scheduled`,
        `${mat["name"]} · ${pickup["preferred_date"]}`,
        `/resident/pickups/${ref}`,
      );
      log("book_pickup", "pickup", ref, { material: materialId, bags: pickup["bags"] });
      return ok(pickup);
    }

    case "verify_pickup_code": {
      const p = db.pickups.find((x) => x["id"] === args["_pickup"]);
      if (!p) return fail("Pickup not found.");
      const c = String(args["_code"] ?? "")
        .trim()
        .toUpperCase();
      if (c !== String(p["qr_code"]).toUpperCase() && c !== String(p["ref"]).toUpperCase()) {
        return fail("This code does not match the pickup.");
      }
      return ok(true);
    }

    case "record_collection": {
      const p = db.pickups.find((x) => x["id"] === args["_pickup"]);
      if (!p) return fail("Pickup not found.");
      if (p["status"] !== "scheduled") return fail("This pickup has already been recorded.");
      const weight = Number(args["_weight"] ?? 0);
      if (!Number.isFinite(weight) || weight <= 0 || weight > 500)
        return fail("Weight must be between 0.1 and 500 kg.");
      const mat = db.materials.find((m) => m["id"] === p["material_id"]);
      const rate = Number(mat?.["points_per_kg"] ?? 10);
      const pendingPts = p["owner_type"] === "resident" ? Math.round(weight * rate) : 0;
      const receiptNo = `REC-${db.seq.receipt++}`;
      const col: Row = {
        id: crypto.randomUUID(),
        pickup_id: p["id"],
        collector_id: uid,
        receipt_no: receiptNo,
        weight_kg: weight,
        accepted: true,
        reject_reason: null,
        photo_path: args["_photo_path"] ?? null,
        offline_recorded: Boolean(args["_offline"]),
        collected_at: nowIso(),
        batch_id: null,
        payout_id: null,
      };
      db.collections.push(col);
      p["status"] = "collected";
      p["points_pending"] = pendingPts;
      p["updated_at"] = nowIso();
      if (pendingPts > 0) {
        const w = db.wallets.find((x) => x["user_id"] === p["owner_id"]);
        if (w) w["pending"] = Number(w["pending"] ?? 0) + pendingPts;
        db.coin_transactions.unshift({
          id: crypto.randomUUID(),
          user_id: p["owner_id"],
          type: "pending",
          amount: pendingPts,
          label: `${mat?.["name"] ?? p["material_id"]} pickup ${p["ref"]} collected (${weight} kg)`,
          created_at: nowIso(),
        });
      }
      notify(
        p["owner_id"],
        "pickup",
        `Pickup ${p["ref"]} weighed`,
        `Recorded ${weight} kg (${receiptNo}).`,
        `/resident/pickups/${p["ref"]}`,
      );
      log("record_collection", "pickup", String(p["ref"]), { weight });
      return ok(col);
    }

    case "reject_pickup": {
      const p = db.pickups.find((x) => x["id"] === args["_pickup"]);
      if (!p) return fail("Pickup not found.");
      if (p["status"] !== "scheduled") return fail("This pickup has already been recorded.");
      const reason = String(args["_reason"] ?? "Rejected");
      const col: Row = {
        id: crypto.randomUUID(),
        pickup_id: p["id"],
        collector_id: uid,
        receipt_no: null,
        weight_kg: null,
        accepted: false,
        reject_reason: reason,
        photo_path: null,
        offline_recorded: Boolean(args["_offline"]),
        collected_at: nowIso(),
        batch_id: null,
        payout_id: null,
      };
      db.collections.push(col);
      p["status"] = "rejected";
      p["updated_at"] = nowIso();
      notify(
        p["owner_id"],
        "pickup",
        `Pickup ${p["ref"]} rejected`,
        reason,
        `/resident/pickups/${p["ref"]}`,
      );
      log("reject_pickup", "pickup", String(p["ref"]), { reason });
      return ok(col);
    }

    case "create_batch": {
      const ids = (args["_pickup_ids"] as string[]) ?? [];
      if (ids.length === 0) return fail("Select at least one collected pickup.");
      const picks = ids
        .map((id) => db.pickups.find((p) => p["id"] === id))
        .filter((x): x is Row => !!x);
      if (picks.length !== ids.length) return fail("One or more pickups were not found.");
      const mats = new Set(picks.map((p) => p["material_id"]));
      if (mats.size > 1) return fail("A batch can only contain one material.");
      const proc = db.organizations.find((o) => o["id"] === args["_processor_org"]);
      if (!proc) return fail("Processor organisation not found.");

      const ref = `BT-${db.seq.batch++}`;
      const batchId = crypto.randomUUID();
      let totalKg = 0;
      for (const p of picks) {
        const c = db.collections.find((x) => x["pickup_id"] === p["id"]);
        const w = Number(c?.["weight_kg"] ?? 0);
        totalKg += w;
        p["status"] = "batched";
        p["batch_id"] = batchId;
        if (c) c["batch_id"] = batchId;
        db.batch_items.push({
          batch_id: batchId,
          collection_id: c?.["id"] ?? "",
          pickup_id: p["id"],
          weight_kg: w,
        });
      }
      const batch: Row = {
        id: batchId,
        ref,
        qr_code: `RMK-${ref}`,
        material_id: picks[0]!["material_id"],
        total_kg: Math.round(totalKg * 100) / 100,
        processor_name: proc["name"],
        processor_org_id: proc["id"],
        status: "ready",
        created_at: nowIso(),
      };
      db.batches.unshift(batch);
      log("create_batch", "batch", ref, { total_kg: batch["total_kg"] });
      return ok(batch);
    }

    case "hand_over_batch": {
      const b = db.batches.find((x) => x["id"] === args["_batch"]);
      if (!b) return fail("Batch not found.");
      b["status"] = "in_transit";
      log("hand_over_batch", "batch", String(b["ref"]));
      return ok(b);
    }

    case "verify_batch": {
      const b = db.batches.find((x) => x["id"] === args["_batch"]);
      if (!b) return fail("Batch not found.");
      if (b["status"] === "verified") return fail("Batch already verified.");
      const actual = Number(args["_actual"] ?? 0);
      const rejected = Number(args["_rejected"] ?? 0);
      const accepted = Math.max(0, Math.round((actual - rejected) * 100) / 100);
      const decision = accepted <= 0 ? "rejected" : rejected > 0 ? "partial" : "accepted";
      const ver: Row = {
        batch_id: b["id"],
        accepted_kg: accepted,
        actual_kg: actual,
        rejected_kg: rejected,
        grade: String(args["_grade"] ?? "Grade A"),
        note: args["_note"] ? String(args["_note"]) : null,
        decision,
        verified_at: nowIso(),
        verified_by: uid,
      };
      db.batch_verifications.push(ver);
      b["status"] = "verified";

      const items = db.batch_items.filter((i) => i["batch_id"] === b["id"]);
      const totalDeclared = items.reduce((s, i) => s + Number(i["weight_kg"] ?? 0), 0) || 1;
      const ratio = accepted / totalDeclared;
      const mat = db.materials.find((m) => m["id"] === b["material_id"]);
      const rate = Number(mat?.["points_per_kg"] ?? 10);

      for (const it of items) {
        const p = db.pickups.find((x) => x["id"] === it["pickup_id"]);
        if (!p) continue;
        const accKg = Math.round(Number(it["weight_kg"] ?? 0) * ratio * 100) / 100;
        p["status"] = "verified";
        p["accepted_kg"] = accKg;
        if (p["owner_type"] === "resident") {
          const pend = Number(p["points_pending"] ?? 0);
          const awarded = Math.round(accKg * rate);
          p["points_awarded"] = awarded;
          p["points_pending"] = 0;
          const w = db.wallets.find((x) => x["user_id"] === p["owner_id"]);
          if (w) {
            w["pending"] = Math.max(0, Number(w["pending"] ?? 0) - pend);
            w["available"] = Number(w["available"] ?? 0) + awarded;
          }
          db.coin_transactions.unshift({
            id: crypto.randomUUID(),
            user_id: p["owner_id"],
            type: "earned",
            amount: awarded,
            label: `${mat?.["name"] ?? p["material_id"]} pickup ${p["ref"]} verified`,
            created_at: nowIso(),
          });
          notify(
            p["owner_id"],
            "coins",
            "Green Coins available",
            `+${awarded} coins released for ${p["ref"]} (${accKg} kg accepted).`,
            "/resident/rewards",
          );
        }
      }
      log("verify_batch", "batch", String(b["ref"]), { accepted, rejected, decision });
      return ok(ver);
    }

    case "lookup_batch_code": {
      const code = String(args["_code"] ?? "")
        .trim()
        .toUpperCase();
      const b = db.batches.find(
        (x) =>
          String(x["qr_code"]).toUpperCase() === code || String(x["ref"]).toUpperCase() === code,
      );
      if (!b) return fail("No batch matches this code.");
      return ok(b["ref"]);
    }

    case "redeem_reward": {
      const rw = db.rewards.find((r) => r["id"] === args["_reward"]);
      if (!rw || !rw["active"]) return fail("This reward is not available.");
      if (Number(rw["stock"] ?? 0) <= 0) return fail("This reward is out of stock.");
      const w = db.wallets.find((x) => x["user_id"] === uid);
      const avail = Number(w?.["available"] ?? 0);
      const cost = Number(rw["cost"] ?? 0);
      if (avail < cost) return fail(`You need ${cost - avail} more Green Coins.`);
      if (w) w["available"] = avail - cost;
      rw["stock"] = Number(rw["stock"]) - 1;
      const ref = `RD-${db.seq.redemption++}`;
      const voucher = `RMK-${String(rw["id"])
        .replace(/[^a-zA-Z]/g, "")
        .slice(0, 3)
        .toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      const red: Row = {
        id: crypto.randomUUID(),
        ref,
        user_id: uid,
        reward_id: rw["id"],
        name: rw["name"],
        partner: rw["partner"],
        value_gmd: rw["value_gmd"],
        cost,
        voucher,
        status: "Issued",
        payout_id: null,
        created_at: nowIso(),
      };
      db.redemptions.unshift(red);
      db.coin_transactions.unshift({
        id: crypto.randomUUID(),
        user_id: uid,
        type: "redeemed",
        amount: -cost,
        label: String(rw["name"]),
        created_at: nowIso(),
      });
      notify(
        uid,
        "reward",
        "Reward redeemed",
        `${rw["name"]} · voucher ${voucher}`,
        "/resident/rewards",
      );
      log("redeem_reward", "redemption", ref, { reward: rw["id"], cost });
      return ok(red);
    }

    case "request_collector_payout": {
      const existing = db.payouts.find(
        (p) => p["payee_user_id"] === uid && p["kind"] === "collector" && p["status"] === "pending",
      );
      if (existing) return fail("You already have a payout request waiting to be paid.");
      const unpaid = db.collections.filter(
        (c) =>
          c["collector_id"] === uid && c["accepted"] && c["weight_kg"] != null && !c["payout_id"],
      );
      if (unpaid.length === 0) return fail("There are no unpaid collections to pay out.");
      const rate = Number(
        db.platform_settings.find((s) => s["key"] === "collector_rate_gmd_per_kg")?.["value"] ?? 6,
      );
      const kg = unpaid.reduce((s, c) => s + Number(c["weight_kg"] ?? 0), 0);
      const po: Row = {
        id: crypto.randomUUID(),
        ref: `PO-${db.seq.payout++}`,
        kind: "collector",
        payee_user_id: uid,
        payee_name: meProfile?.["full_name"] ?? "Collector",
        item_count: unpaid.length,
        quantity: kg,
        rate,
        amount_gmd: Math.round(kg * rate * 100) / 100,
        status: "pending",
        method: null,
        reference: null,
        note: null,
        created_at: nowIso(),
        paid_at: null,
      };
      db.payouts.unshift(po);
      for (const c of unpaid) c["payout_id"] = po["id"];
      log("create_payout", "payout", String(po["ref"]), {
        kind: "collector",
        amount: po["amount_gmd"],
      });
      return ok(po);
    }

    case "admin_payout_balances": {
      const rate = Number(
        db.platform_settings.find((s) => s["key"] === "collector_rate_gmd_per_kg")?.["value"] ?? 6,
      );
      const colMap = new Map<string, { item_count: number; quantity: number }>();
      for (const c of db.collections) {
        if (!c["accepted"] || c["weight_kg"] == null || c["payout_id"]) continue;
        const cid = String(c["collector_id"] ?? "");
        const prev = colMap.get(cid) ?? { item_count: 0, quantity: 0 };
        prev.item_count += 1;
        prev.quantity += Number(c["weight_kg"]);
        colMap.set(cid, prev);
      }
      const partMap = new Map<string, { item_count: number; amount_gmd: number }>();
      for (const r of db.redemptions) {
        if (r["status"] === "Cancelled" || r["payout_id"] || !r["partner"]) continue;
        const pname = String(r["partner"]);
        const prev = partMap.get(pname) ?? { item_count: 0, amount_gmd: 0 };
        prev.item_count += 1;
        prev.amount_gmd += Number(r["value_gmd"] ?? 0);
        partMap.set(pname, prev);
      }
      const out: Row[] = [];
      for (const [cid, v] of colMap) {
        const prof = db.profiles.find((p) => p["id"] === cid);
        out.push({
          kind: "collector",
          payee_user_id: cid,
          payee_name: prof?.["full_name"] ?? prof?.["email"] ?? "Collector",
          item_count: v.item_count,
          quantity: v.quantity,
          amount_gmd: Math.round(v.quantity * rate * 100) / 100,
        });
      }
      for (const [pname, v] of partMap) {
        out.push({
          kind: "partner",
          payee_user_id: null,
          payee_name: pname,
          item_count: v.item_count,
          quantity: v.item_count,
          amount_gmd: v.amount_gmd,
        });
      }
      return ok(out);
    }

    case "admin_create_collector_payout": {
      const cid = String(args["_collector"] ?? "");
      const unpaid = db.collections.filter(
        (c) =>
          c["collector_id"] === cid && c["accepted"] && c["weight_kg"] != null && !c["payout_id"],
      );
      if (unpaid.length === 0) return fail("There are no unpaid collections to pay out.");
      const rate = Number(
        db.platform_settings.find((s) => s["key"] === "collector_rate_gmd_per_kg")?.["value"] ?? 6,
      );
      const kg = unpaid.reduce((s, c) => s + Number(c["weight_kg"] ?? 0), 0);
      const prof = db.profiles.find((p) => p["id"] === cid);
      const po: Row = {
        id: crypto.randomUUID(),
        ref: `PO-${db.seq.payout++}`,
        kind: "collector",
        payee_user_id: cid,
        payee_name: prof?.["full_name"] ?? "Collector",
        item_count: unpaid.length,
        quantity: kg,
        rate,
        amount_gmd: Math.round(kg * rate * 100) / 100,
        status: "pending",
        method: null,
        reference: null,
        note: null,
        created_at: nowIso(),
        paid_at: null,
      };
      db.payouts.unshift(po);
      for (const c of unpaid) c["payout_id"] = po["id"];
      return ok(po);
    }

    case "admin_create_partner_payout": {
      const pname = String(args["_partner"] ?? "").trim();
      const unpaid = db.redemptions.filter(
        (r) => r["partner"] === pname && r["status"] !== "Cancelled" && !r["payout_id"],
      );
      if (unpaid.length === 0) return fail("There are no unpaid vouchers for this partner.");
      const amt = unpaid.reduce((s, r) => s + Number(r["value_gmd"] ?? 0), 0);
      const po: Row = {
        id: crypto.randomUUID(),
        ref: `PO-${db.seq.payout++}`,
        kind: "partner",
        payee_user_id: null,
        partner: pname,
        payee_name: pname,
        item_count: unpaid.length,
        quantity: unpaid.length,
        rate: null,
        amount_gmd: Math.round(amt * 100) / 100,
        status: "pending",
        method: null,
        reference: null,
        note: null,
        created_at: nowIso(),
        paid_at: null,
      };
      db.payouts.unshift(po);
      for (const r of unpaid) r["payout_id"] = po["id"];
      return ok(po);
    }

    case "admin_mark_payout_paid": {
      const po = db.payouts.find((p) => p["id"] === args["_payout"]);
      if (!po) return fail("Payout not found.");
      po["status"] = "paid";
      po["method"] = String(args["_method"] ?? "Cash");
      po["reference"] = args["_reference"] ? String(args["_reference"]) : null;
      po["note"] = args["_note"] ? String(args["_note"]) : null;
      po["paid_at"] = nowIso();
      return ok(po);
    }

    case "admin_cancel_payout": {
      const po = db.payouts.find((p) => p["id"] === args["_payout"]);
      if (!po) return fail("Payout not found.");
      po["status"] = "cancelled";
      po["note"] = args["_note"] ? String(args["_note"]) : null;
      for (const c of db.collections) if (c["payout_id"] === po["id"]) c["payout_id"] = null;
      for (const r of db.redemptions) if (r["payout_id"] === po["id"]) r["payout_id"] = null;
      return ok(po);
    }

    case "mark_notifications_read": {
      const ids = args["_ids"] as string[] | undefined;
      for (const n of db.notifications) {
        if (n["user_id"] === uid && (!ids || ids.includes(String(n["id"])))) {
          n["read_at"] = nowIso();
        }
      }
      return ok(null);
    }

    case "update_my_profile": {
      if (meProfile) {
        meProfile["full_name"] = String(args["_full_name"] ?? meProfile["full_name"]);
        meProfile["phone"] = String(args["_phone"] ?? meProfile["phone"]);
        meProfile["address"] = String(args["_address"] ?? meProfile["address"]);
        meProfile["area"] = String(args["_area"] ?? meProfile["area"]);
        meProfile["language"] = String(args["_language"] ?? meProfile["language"]);
        meProfile["sms_alerts"] = Boolean(args["_sms_alerts"] ?? meProfile["sms_alerts"]);
        meProfile["updated_at"] = nowIso();
      }
      return ok(null);
    }

    case "set_pickup_location": {
      const existing = db.pickup_locations.find((l) => l["pickup_id"] === args["_pickup"]);
      const loc: Row = {
        pickup_id: args["_pickup"],
        lat: Number(args["_lat"]),
        lng: Number(args["_lng"]),
        source: String(args["_source"] ?? "area"),
        label: String(args["_label"] ?? ""),
        updated_at: nowIso(),
      };
      if (existing) Object.assign(existing, loc);
      else db.pickup_locations.push(loc);
      return ok(null);
    }

    case "admin_set_user_active": {
      const u = db.profiles.find((p) => p["id"] === args["_user"]);
      if (u) u["active"] = Boolean(args["_active"]);
      return ok(null);
    }

    case "admin_assign_collector": {
      const p = db.pickups.find((x) => x["id"] === args["_pickup"]);
      const c = db.profiles.find((x) => x["id"] === args["_collector"]);
      if (p && c) {
        p["collector_id"] = c["id"];
        p["collector_name"] = c["full_name"];
      }
      return ok(null);
    }

    case "admin_update_material": {
      const m = db.materials.find((x) => x["id"] === args["_id"]);
      if (m) {
        m["points_per_kg"] = Number(args["_points"]);
        m["active"] = Boolean(args["_active"]);
      }
      return ok(null);
    }

    case "admin_set_org_status": {
      const o = db.organizations.find((x) => x["id"] === args["_org"]);
      if (o) o["status"] = String(args["_status"]);
      return ok(null);
    }

    case "admin_upsert_reward": {
      const r = db.rewards.find((x) => x["id"] === args["_id"]);
      if (r) {
        r["name"] = args["_name"];
        r["partner"] = args["_partner"];
        r["category"] = args["_category"];
        r["cost"] = Number(args["_cost"]);
        r["value_gmd"] = Number(args["_value"]);
        r["stock"] = Number(args["_stock"]);
        r["active"] = Boolean(args["_active"]);
      }
      return ok(null);
    }

    case "admin_set_redemption_status": {
      const r = db.redemptions.find((x) => x["id"] === args["_id"]);
      if (r) r["status"] = String(args["_status"]);
      return ok(null);
    }

    case "admin_set_setting": {
      const s = db.platform_settings.find((x) => x["key"] === args["_key"]);
      if (s) s["value"] = Number(args["_value"]);
      return ok(null);
    }

    case "admin_decide_role_request": {
      const req = db.role_requests.find((r) => r["id"] === args["_request"]);
      if (req) {
        req["status"] = args["_approve"] ? "approved" : "rejected";
        if (args["_approve"]) {
          db.user_roles.push({
            id: crypto.randomUUID(),
            user_id: req["user_id"],
            role: req["role"],
            created_at: nowIso(),
          });
        }
      }
      return ok(null);
    }

    case "book_pickup_streams":
    case "confirm_scan":
    case "save_location":
    case "delete_saved_location":
    case "register_institution":
    case "update_institution_settings":
    case "admin_decide_specialisation":
    case "list_collector_memberships":
    case "request_collector_membership":
    case "respond_collector_invitation":
    case "invite_collector":
    case "set_collector_membership_status":
    case "set_collector_restrictions":
    case "my_collector_presence":
    case "start_collector_shift":
    case "end_collector_shift":
    case "set_collector_status":
    case "update_collector_location":
    case "institution_fleet":
    case "track_pickup_collector":
    case "list_collector_shifts":
    case "assignment_queue":
    case "respond_to_assignment":
    case "route_pickup":
    case "process_assignment_timeouts":
    case "list_disputes":
    case "raise_dispute":
    case "admin_resolve_dispute":
    case "institution_analytics":
      return {
        data: null,
        error: { message: "This feature isn't connected to the server yet.", code: "PGRST202" },
      };

    default:
      return ok(null);
  }
}

export function createMockSupabaseClient(overrideUid?: string) {
  const auth = {
    getSession: async () => ({ data: { session: loadSession() }, error: null }),
    getUser: async () => ({ data: { user: loadSession()?.user ?? null }, error: null }),
    getClaims: async (token: string) => {
      const sub = token.startsWith("mock-token:")
        ? token.slice("mock-token:".length)
        : (loadSession()?.user.id ?? RESIDENT_DEMO_ID);
      return { data: { claims: { sub } }, error: null };
    },
    onAuthStateChange: (cb: (event: string, session: MockSession | null) => void) => {
      authListeners.add(cb);
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              authListeners.delete(cb);
            },
          },
        },
      };
    },
    signOut: async () => {
      saveSession(null);
      emitAuth("SIGNED_OUT", null);
      return { error: null };
    },
    setSession: async (tokens: { access_token?: string }) => {
      const cur = loadSession();
      if (cur && tokens.access_token) cur.access_token = tokens.access_token;
      return { data: { session: cur }, error: null };
    },
    signInAnonymously: async (opts?: { options?: { data?: Record<string, unknown> } }) => {
      const meta = opts?.options?.data ?? {};
      const acct = String(meta["account_type"] ?? "resident");
      const ws = meta["workspace"] ? String(meta["workspace"]) : null;
      const role = acct === "institution" && ws ? ws : acct;
      const uid = role === "collector" ? COLLECTOR_DEMO_ID : crypto.randomUUID();
      const email = String(meta["email"] ?? "guest@remake.gm");
      const fullName = String(meta["full_name"] ?? "Demo User");

      const db = loadDb();
      let prof = db.profiles.find((p) => p["id"] === uid);
      if (!prof) {
        prof = {
          id: uid,
          email,
          full_name: fullName,
          phone: String(meta["phone"] ?? "+220 771 2345"),
          address: String(meta["address"] ?? "14 Kairaba Avenue"),
          area: String(meta["area"] ?? "Kanifing"),
          language: "English",
          sms_alerts: true,
          account_type: role,
          active: true,
          created_at: nowIso(),
          updated_at: nowIso(),
        };
        db.profiles.push(prof);
      } else {
        prof["email"] = email;
        prof["full_name"] = fullName;
        prof["phone"] = String(meta["phone"] ?? prof["phone"]);
        prof["address"] = String(meta["address"] ?? prof["address"]);
        prof["area"] = String(meta["area"] ?? prof["area"]);
        prof["account_type"] = role;
      }

      if (!db.wallets.some((w) => w["user_id"] === uid)) {
        db.wallets.push({ user_id: uid, available: 0, pending: 0, updated_at: nowIso() });
      }

      const rolesToGrant =
        role === "admin"
          ? ["resident", "business", "collector", "hub", "processor", "admin"]
          : [role];
      for (const r of rolesToGrant) {
        if (!db.user_roles.some((ur) => ur["user_id"] === uid && ur["role"] === r)) {
          db.user_roles.push({
            id: crypto.randomUUID(),
            user_id: uid,
            role: r,
            created_at: nowIso(),
          });
        }
      }

      if (role === "business" && meta["business_name"]) {
        const newBizId = crypto.randomUUID();
        db.organizations.push({
          id: newBizId,
          name: String(meta["business_name"]),
          kind: "business",
          phone: String(meta["phone"] ?? ""),
          address: String(meta["address"] ?? ""),
          area: String(meta["area"] ?? "Kololi"),
          materials: [],
          status: "onboarding",
          created_at: nowIso(),
        });
        db.organization_members.push({ org_id: newBizId, user_id: uid, created_at: nowIso() });
      }

      saveDb(db);
      const session: MockSession = {
        access_token: `mock-token:${uid}`,
        user: { id: uid, email, user_metadata: meta },
      };
      saveSession(session);
      emitAuth("SIGNED_IN", session);
      return { data: { user: session.user, session }, error: null };
    },
  };

  return {
    auth,
    from: (table: string) => createQueryBuilder(table),
    rpc: (fn: string, args: Row = {}) => Promise.resolve(handleRpc(fn, args, overrideUid)),
    storage: {
      from: (_bucket: string) => ({
        upload: async (path: string) => ({ data: { path }, error: null }),
        createSignedUrl: async (_path: string, _ttl: number) => ({
          data: { signedUrl: null },
          error: null,
        }),
      }),
    },
    channel: (_name: string) => {
      const ch = {
        on: () => ch,
        subscribe: () => ch,
      };
      return ch;
    },
    removeChannel: async () => "ok",
  } as unknown as ReturnType<typeof import("@supabase/supabase-js").createClient<Database>>;
}
