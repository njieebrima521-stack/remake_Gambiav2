import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { format, subDays } from "date-fns";
import {
  Boxes,
  Check,
  ChevronRight,
  Inbox,
  Layers,
  MapPin,
  PackageCheck,
  Plus,
  Settings,
  Truck,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BatchStatusBadge,
  PageHeader,
  Panel,
  PickupStatusBadge,
  StatCard,
} from "@/components/remake/ui";
import { useRemake } from "@/lib/remake/store";
import { AREAS, HUB_NAME, MATERIALS } from "@/lib/remake/data";
import { errorMessage } from "@/lib/remake/logic";
import { fmtKg, fmtShortDate } from "@/lib/remake/format";
import { MATERIAL_TYPES, materialTypeName, type MaterialTypeId } from "@/lib/remake/material-types";
import {
  inviteCollector,
  listInstitutions,
  listMemberships,
  registerInstitution,
  setMembershipRestrictions,
  setMembershipStatus,
  updateInstitutionSettings,
  type ApprovalStatus,
  type CollectorMembership,
  type Institution,
  type OperatingStatus,
} from "@/lib/remake/services/institutions";
import {
  listAssignmentQueue,
  respondToAssignment,
  getInstitutionAnalytics,
  type AssignmentRequest,
  type InstitutionAnalytics,
} from "@/lib/remake/services/operations";
import { isStale, listFleet, type CollectorPresence } from "@/lib/remake/services/tracking";
import type { MaterialId } from "@/lib/remake/types";
import { cn } from "@/lib/utils";

type HubSection = "overview" | "collectors" | "collections" | "materials" | "settings";

const VALID_SECTIONS: readonly HubSection[] = [
  "overview",
  "collectors",
  "collections",
  "materials",
  "settings",
];

export const Route = createFileRoute("/_authenticated/hub/")({
  validateSearch: (s: Record<string, unknown>): { section?: HubSection | undefined } => ({
    section:
      typeof s["section"] === "string" && VALID_SECTIONS.includes(s["section"] as HubSection)
        ? (s["section"] as HubSection)
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Institution & Hub — Remake" },
      {
        name: "description",
        content:
          "Manage your Remake recycling institution: overview, specialisations, collectors, assignment offers and hub batches.",
      },
      { property: "og:title", content: "Institution & Hub — Remake" },
      { property: "og:description", content: "Remake recycling hub & institution workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HubPage,
});

const inputCls =
  "mt-1.5 h-11 w-full rounded-xl border bg-card px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

function ApprovalBadge({ status }: { status: ApprovalStatus }) {
  const variant =
    status === "approved"
      ? "success"
      : status === "pending"
        ? "warning"
        : status === "rejected"
          ? "danger"
          : "muted";
  return (
    <Badge variant={variant} className="capitalize">
      {status}
    </Badge>
  );
}

function HubPage() {
  const { state, createBatch } = useRemake();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/hub/" });
  const activeSection: HubSection = search.section ?? "overview";

  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [orgLoadState, setOrgLoadState] = useState<"loading" | "ready" | "unavailable">("loading");
  const myOrgRef = state.me?.orgs.find((o) => o.kind === "hub");
  const myOrg = useMemo(
    () =>
      institutions.find((o) => o.id === myOrgRef?.id) ??
      institutions.find((o) => o.kind === "hub") ??
      null,
    [institutions, myOrgRef?.id],
  );

  const loadInstitutionsList = useCallback(() => {
    listInstitutions()
      .then((list) => {
        setInstitutions(list);
        setOrgLoadState("ready");
      })
      .catch(() => {
        setOrgLoadState("unavailable");
      });
  }, []);

  useEffect(() => {
    loadInstitutionsList();
  }, [loadInstitutionsList]);

  const setSection = (sec: HubSection) => {
    navigate({ search: { section: sec } });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={myOrg?.name ?? myOrgRef?.name ?? HUB_NAME}
        title="Institution operations"
        description="Manage material specialisations, collectors, incoming assignment offers and recycling hub batches."
      />

      {activeSection === "overview" && (
        <HubOverviewSection myOrg={myOrg} onOpenSection={setSection} />
      )}
      {activeSection === "collectors" && <HubCollectorsSection myOrg={myOrg} />}
      {activeSection === "collections" && (
        <HubCollectionsSection myOrg={myOrg} createBatch={createBatch} />
      )}
      {activeSection === "materials" && (
        <HubSpecialisationsSection
          myOrg={myOrg}
          institutions={institutions}
          loadState={orgLoadState}
          onUpdated={loadInstitutionsList}
          onOpenSettings={() => setSection("settings")}
        />
      )}
      {activeSection === "settings" && (
        <HubSettingsSection myOrg={myOrg} loadState={orgLoadState} onSaved={loadInstitutionsList} />
      )}
    </div>
  );
}

function HubOverviewSection({
  myOrg,
  onOpenSection,
}: {
  myOrg: Institution | null;
  onOpenSection: (s: HubSection) => void;
}) {
  const { state } = useRemake();
  const incoming = state.pickups.filter((p) => p.status === "scheduled");
  const received = state.pickups.filter((p) => p.status === "collected");
  const [analytics, setAnalytics] = useState<InstitutionAnalytics | null>(null);
  const [analyticsState, setAnalyticsState] = useState<"loading" | "ready" | "unavailable">(
    "loading",
  );

  useEffect(() => {
    const to = format(new Date(), "yyyy-MM-dd");
    const from = format(subDays(new Date(), 30), "yyyy-MM-dd");
    getInstitutionAnalytics(from, to, myOrg?.id)
      .then((res) => {
        setAnalytics(res);
        setAnalyticsState("ready");
      })
      .catch(() => {
        setAnalyticsState("unavailable");
      });
  }, [myOrg?.id]);

  const hasChartData = !!analytics?.trend.some((t) => t.kg > 0 || t.count > 0);
  const approvedCount = myOrg?.specialisations.filter((s) => s.status === "approved").length ?? 0;

  return (
    <div className="space-y-6">
      {myOrg && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={myOrg.status === "active" ? "success" : "warning"}
              className="capitalize"
            >
              {myOrg.status}
            </Badge>
            <Badge variant="muted" className="capitalize">
              {myOrg.operatingStatus}
            </Badge>
            <span className="text-muted-foreground">
              {approvedCount} approved specialisation{approvedCount === 1 ? "" : "s"} ·{" "}
              {myOrg.serviceAreas.length ? myOrg.serviceAreas.join(", ") : myOrg.area}
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={() => onOpenSection("materials")}>
            <Layers className="size-4" /> Manage specialisations
          </Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Incoming collections"
          value={incoming.length}
          sub="Scheduled on routes"
          icon={Truck}
        />
        <StatCard
          label="Received loads"
          value={received.length}
          sub={fmtKg(received.reduce((s, p) => s + (p.weightKg ?? 0), 0))}
          icon={Inbox}
          tone="brand"
        />
        <StatCard
          label="Batches ready"
          value={state.batches.filter((b) => b.status === "ready").length}
          sub="Awaiting handover"
          icon={Boxes}
        />
        <StatCard
          label="Verified (30d)"
          value={analytics ? fmtKg(analytics.verifiedKg) : "—"}
          sub={
            analytics
              ? `${analytics.completedCollections} completed · ${analytics.activeCollectors} collectors`
              : analyticsState === "loading"
                ? "Loading…"
                : "Not connected"
          }
          icon={PackageCheck}
        />
      </div>

      <Panel
        title="Collection trend (last 30 days)"
        action={
          <Button variant="outline" size="sm" onClick={() => onOpenSection("collections")}>
            Open collections
          </Button>
        }
      >
        {analyticsState === "loading" && (
          <p className="text-sm text-muted-foreground">Loading analytics…</p>
        )}
        {analyticsState === "unavailable" && (
          <p className="text-sm text-muted-foreground">
            Institution analytics not available until backend service is connected.
          </p>
        )}
        {analyticsState === "ready" && !hasChartData && (
          <p className="text-sm text-muted-foreground">
            No collection volume recorded in the last 30 days.
          </p>
        )}
        {analyticsState === "ready" && hasChartData && analytics && (
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={analytics.trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="day" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Bar dataKey="kg" name="Weight (kg)" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>
    </div>
  );
}

function HubCollectorsSection({ myOrg }: { myOrg: Institution | null }) {
  const [memberships, setMemberships] = useState<CollectorMembership[]>([]);
  const [fleet, setFleet] = useState<CollectorPresence[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [contact, setContact] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    Promise.all([listMemberships(myOrg?.id), listFleet(myOrg?.id)])
      .then(([m, f]) => {
        setMemberships(m);
        setFleet(f);
        setLoadState("ready");
      })
      .catch(() => {
        setLoadState("unavailable");
      });
  }, [myOrg?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myOrg || !contact.trim()) return;
    setBusy(true);
    try {
      await inviteCollector(myOrg.id, contact.trim());
      setContact("");
      toast.success("Invitation sent.");
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const updateStatus = async (
    id: string,
    status: "approved" | "suspended" | "removed" | "declined",
  ) => {
    setBusy(true);
    try {
      await setMembershipStatus(id, status);
      toast.success(`Collector ${status}.`);
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const toggleRestriction = async (m: CollectorMembership, mat: MaterialTypeId) => {
    const next = m.restrictions.includes(mat)
      ? m.restrictions.filter((r) => r !== mat)
      : [...m.restrictions, mat];
    setBusy(true);
    try {
      await setMembershipRestrictions(m.id, next);
      toast.success("Permissions updated.");
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const approvedSpecs =
    myOrg?.specialisations.filter((s) => s.status === "approved").map((s) => s.materialType) ?? [];

  return (
    <div className="space-y-6">
      <Panel
        title="Collector memberships"
        description="Invite collectors, review membership requests, and narrow material permissions."
      >
        {myOrg && (
          <form onSubmit={sendInvite} className="mb-5 flex flex-wrap gap-2">
            <input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="Collector email or phone (+220…)"
              className="h-10 min-w-60 flex-1 rounded-xl border bg-card px-3 text-sm outline-none focus:border-primary"
            />
            <Button type="submit" disabled={!contact.trim() || busy}>
              <Plus /> Invite collector
            </Button>
          </form>
        )}

        {loadState === "loading" && (
          <p className="text-sm text-muted-foreground">Loading collectors…</p>
        )}
        {loadState === "unavailable" && (
          <p className="text-sm text-muted-foreground">Collector management is not available.</p>
        )}
        {loadState === "ready" && memberships.length === 0 && (
          <p className="text-sm text-muted-foreground">No collector memberships yet.</p>
        )}
        {loadState === "ready" && memberships.length > 0 && (
          <ul className="divide-y rounded-2xl border">
            {memberships.map((m) => (
              <li key={m.id} className="space-y-3 p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">{m.collectorName}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.collectorPhone || "No phone"} · {m.orgName}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        m.status === "approved"
                          ? "success"
                          : m.status === "requested" || m.status === "invited"
                            ? "warning"
                            : "muted"
                      }
                      className="capitalize"
                    >
                      {m.status}
                    </Badge>
                    {m.status === "requested" && (
                      <>
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() => updateStatus(m.id, "approved")}
                        >
                          <Check /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => updateStatus(m.id, "declined")}
                        >
                          <X /> Decline
                        </Button>
                      </>
                    )}
                    {m.status === "approved" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => updateStatus(m.id, "suspended")}
                      >
                        Suspend
                      </Button>
                    )}
                    {m.status === "suspended" && (
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => updateStatus(m.id, "approved")}
                      >
                        Reactivate
                      </Button>
                    )}
                    {m.status !== "removed" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => updateStatus(m.id, "removed")}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">
                    Effective permissions:{" "}
                    {m.permissions.length
                      ? m.permissions.map((p) => materialTypeName(p)).join(", ")
                      : "None"}
                  </p>
                  {m.status === "approved" && approvedSpecs.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-xs text-muted-foreground">Allowed overrides:</span>
                      {approvedSpecs.map((mat) => {
                        const restricted = m.restrictions.includes(mat);
                        return (
                          <button
                            key={mat}
                            type="button"
                            disabled={busy}
                            onClick={() => toggleRestriction(m, mat)}
                            className={cn(
                              "rounded-full border px-2.5 py-0.5 text-xs font-medium transition",
                              restricted
                                ? "border-destructive/40 bg-danger-soft text-destructive line-through"
                                : "border-primary/40 bg-mint text-mint-foreground",
                            )}
                          >
                            {materialTypeName(mat)}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        title="Authorised collector tracking"
        description="Live status and recent GPS updates for collectors approved for your institution."
      >
        {loadState === "loading" && (
          <p className="text-sm text-muted-foreground">Loading fleet presence…</p>
        )}
        {loadState === "unavailable" && (
          <p className="text-sm text-muted-foreground">Fleet tracking is not available.</p>
        )}
        {loadState === "ready" && fleet.length === 0 && (
          <p className="text-sm text-muted-foreground">No active or registered collectors found.</p>
        )}
        {loadState === "ready" && fleet.length > 0 && (
          <ul className="divide-y rounded-2xl border">
            {fleet.map((c) => (
              <li
                key={c.collectorId}
                className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm"
              >
                <div className="flex items-center gap-3">
                  <Users className="size-4 text-primary" />
                  <div>
                    <p className="font-semibold">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.phone || "No phone"}
                      {c.activeAssignment ? ` · Assigned: ${c.activeAssignment}` : ""}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <Badge
                      variant={
                        c.status === "on_pickup"
                          ? "info"
                          : c.status === "on_duty"
                            ? "success"
                            : "muted"
                      }
                      className="capitalize"
                    >
                      {c.status.replace("_", " ")}
                    </Badge>
                    {c.sharing && isStale(c.updatedAt) && <Badge variant="warning">Stale</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {c.sharing && c.updatedAt ? (
                      <>
                        Updated {format(new Date(c.updatedAt), "d MMM HH:mm")}
                        {c.lat != null && c.lng != null
                          ? ` · ${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}`
                          : ""}
                      </>
                    ) : (
                      "Not sharing location"
                    )}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function HubCollectionsSection({
  myOrg,
  createBatch,
}: {
  myOrg: Institution | null;
  createBatch: (pickupIds: string[], processorId: string) => Promise<string>;
}) {
  const { state } = useRemake();
  const navigate = useNavigate();
  const incoming = state.pickups.filter((p) => p.status === "scheduled");
  const received = state.pickups.filter((p) => p.status === "collected");
  const [sel, setSel] = useState<string[]>([]);
  const processors = state.processors.filter((o) => o.status !== "suspended");
  const [processorPick, setProcessor] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const [offers, setOffers] = useState<AssignmentRequest[]>([]);
  const [offersState, setOffersState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [collectors, setCollectors] = useState<CollectorMembership[]>([]);
  const [pickedCollector, setPickedCollector] = useState<Record<string, string>>({});
  const [offerBusy, setOfferBusy] = useState(false);

  const loadOffers = useCallback(() => {
    Promise.all([listAssignmentQueue("institution", myOrg?.id), listMemberships(myOrg?.id)])
      .then(([q, mems]) => {
        setOffers(q);
        setCollectors(mems.filter((m) => m.status === "approved"));
        setOffersState("ready");
      })
      .catch(() => {
        setOffersState("unavailable");
      });
  }, [myOrg?.id]);

  useEffect(() => {
    loadOffers();
  }, [loadOffers]);

  const answerOffer = async (offer: AssignmentRequest, accept: boolean) => {
    if (!offer.attemptId) return;
    setOfferBusy(true);
    try {
      await respondToAssignment(
        offer.attemptId,
        accept,
        accept ? pickedCollector[offer.attemptId] : undefined,
      );
      toast.success(accept ? `Accepted ${offer.pickupRef}` : `Declined ${offer.pickupRef}`);
      loadOffers();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setOfferBusy(false);
    }
  };

  function selMatFor(mats: string[]) {
    return (
      !!sel.length && mats.includes(state.pickups.find((p) => p.id === sel[0])?.material ?? "")
    );
  }
  const suggested = processors.find((o) => selMatFor(o.materials)) ?? processors[0];
  const processor = processorPick || suggested?.id || "";
  const selMat = useMemo<MaterialId | null>(
    () => (sel.length ? (state.pickups.find((p) => p.id === sel[0])?.material ?? null) : null),
    [sel, state.pickups],
  );
  const selKg = received
    .filter((p) => sel.includes(p.id))
    .reduce((s, p) => s + (p.weightKg ?? 0), 0);

  const toggle = (id: string, mat: MaterialId) => {
    if (selMat && selMat !== mat && !sel.includes(id)) {
      toast.error("A batch can only contain one material");
      return;
    }
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };
  const create = async () => {
    if (!processor) {
      toast.error("Choose a processor");
      return;
    }
    setBusy(true);
    try {
      const id = await createBatch(sel, processor);
      setSel([]);
      toast.success(`Batch ${id} created`);
      navigate({ to: "/hub/batches/$id", params: { id } });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Panel
        title="Incoming pickup offers"
        description="Pickup streams routed to your institution based on approved specialisations, area and capacity."
      >
        {offersState === "loading" && (
          <p className="text-sm text-muted-foreground">Loading offers…</p>
        )}
        {offersState === "unavailable" && (
          <p className="text-sm text-muted-foreground">Assignment queue is not available.</p>
        )}
        {offersState === "ready" && offers.length === 0 && (
          <p className="text-sm text-muted-foreground">No pending assignment offers.</p>
        )}
        {offersState === "ready" && offers.length > 0 && (
          <ul className="divide-y rounded-2xl border">
            {offers.map((o) => {
              const eligible = collectors.filter((c) => c.permissions.includes(o.materialType));
              const aid = o.attemptId ?? o.pickupId;
              return (
                <li
                  key={aid}
                  className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm"
                >
                  <div>
                    <p className="font-semibold">
                      <span className="font-mono">{o.pickupRef}</span> ·{" "}
                      {materialTypeName(o.materialType)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {o.customer} · {o.area} · {fmtShortDate(o.date)}
                      {o.expiresAt ? ` · Expires ${format(new Date(o.expiresAt), "HH:mm")}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={pickedCollector[aid] ?? ""}
                      onChange={(e) =>
                        setPickedCollector((prev) => ({ ...prev, [aid]: e.target.value }))
                      }
                      className="h-9 rounded-lg border bg-card px-2 text-xs"
                      aria-label={`Assign collector for ${o.pickupRef}`}
                    >
                      <option value="">Auto-assign eligible collector</option>
                      {eligible.map((c) => (
                        <option key={c.collectorId} value={c.collectorId}>
                          {c.collectorName}
                        </option>
                      ))}
                    </select>
                    <Button
                      size="sm"
                      disabled={offerBusy || !o.attemptId}
                      onClick={() => answerOffer(o, true)}
                    >
                      <Check /> Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={offerBusy || !o.attemptId}
                      onClick={() => answerOffer(o, false)}
                    >
                      <X /> Decline
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Tabs defaultValue="received">
        <TabsList className="flex h-auto w-full flex-wrap justify-start sm:w-auto">
          <TabsTrigger value="received">Received loads &amp; batching</TabsTrigger>
          <TabsTrigger value="incoming">Incoming</TabsTrigger>
          <TabsTrigger value="batches">Batches</TabsTrigger>
        </TabsList>
        <TabsContent value="received" className="mt-4">
          <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
            <Panel
              title="Received loads"
              description="Select loads of the same material to batch them."
            >
              {received.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No loads waiting. Collected pickups appear here.
                </p>
              ) : (
                <ul className="divide-y">
                  {received.map((p) => (
                    <li key={p.id} className="flex items-center gap-4 py-3">
                      <Checkbox
                        checked={sel.includes(p.id)}
                        onCheckedChange={() => toggle(p.id, p.material)}
                        aria-label={`Select ${p.id}`}
                      />
                      <img
                        src={MATERIALS[p.material].image}
                        alt=""
                        className="size-10 rounded-lg object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">
                          {p.customer}{" "}
                          <span className="font-mono text-xs text-muted-foreground">
                            {p.receiptNo}
                          </span>
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {MATERIALS[p.material].name} · by {p.collector}
                        </p>
                      </div>
                      <b className="tabular">{fmtKg(p.weightKg ?? 0)}</b>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel title="Create batch">
              <p className="text-sm text-muted-foreground">
                {sel.length
                  ? `${sel.length} loads · ${MATERIALS[selMat!].name} · ${fmtKg(selKg)}`
                  : "No loads selected"}
              </p>
              <label className="mt-4 block text-sm font-medium">
                Processor
                <select
                  value={processor}
                  onChange={(e) => setProcessor(e.target.value)}
                  className="mt-1.5 h-11 w-full rounded-xl border bg-card px-3 text-sm"
                >
                  {processors.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                      {x.status === "onboarding" ? " (onboarding)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                className="mt-4 w-full"
                size="lg"
                disabled={!sel.length || busy}
                onClick={create}
              >
                <Boxes /> Create batch &amp; QR
              </Button>
            </Panel>
          </div>
        </TabsContent>
        <TabsContent value="incoming" className="mt-4">
          <Panel title="Incoming collections">
            {incoming.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No pickups scheduled on routes right now.
              </p>
            )}
            <ul className="divide-y">
              {incoming.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span>
                    <b>{p.customer}</b> · {MATERIALS[p.material].name} · {p.bags} bags
                    <br />
                    <span className="text-muted-foreground">
                      {p.collector} · {fmtShortDate(p.date)} {p.slot}
                    </span>
                  </span>
                  <PickupStatusBadge status={p.status} />
                </li>
              ))}
            </ul>
          </Panel>
        </TabsContent>
        <TabsContent value="batches" className="mt-4">
          <Panel title="All batches">
            {state.batches.length === 0 && (
              <p className="text-sm text-muted-foreground">No batches yet.</p>
            )}
            <ul className="divide-y">
              {state.batches.map((b) => (
                <li key={b.id}>
                  <Link
                    to="/hub/batches/$id"
                    params={{ id: b.id }}
                    className="flex items-center gap-4 py-3 hover:bg-muted/40"
                  >
                    <span className="font-mono text-sm font-semibold">{b.id}</span>
                    <span className="flex-1 text-sm">
                      {MATERIALS[b.material].name} · {fmtKg(b.totalKg)} → {b.processor}
                    </span>
                    <BatchStatusBadge status={b.status} />
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function HubSpecialisationsSection({
  myOrg,
  institutions,
  loadState,
  onUpdated,
  onOpenSettings,
}: {
  myOrg: Institution | null;
  institutions: Institution[];
  loadState: "loading" | "ready" | "unavailable";
  onUpdated: () => void;
  onOpenSettings: () => void;
}) {
  const [selected, setSelected] = useState<MaterialTypeId[]>([]);
  const [busy, setBusy] = useState(false);

  const declaredMap = useMemo(() => {
    const map = new Map<MaterialTypeId, Institution["specialisations"][number]>();
    for (const s of myOrg?.specialisations ?? []) map.set(s.materialType, s);
    return map;
  }, [myOrg]);

  const toggleNew = (id: MaterialTypeId) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const submitRequests = async () => {
    if (!myOrg || selected.length === 0) return;
    setBusy(true);
    try {
      await updateInstitutionSettings(myOrg.id, {
        phone: myOrg.phone,
        address: myOrg.address,
        area: myOrg.area,
        serviceAreas: myOrg.serviceAreas,
        operatingStatus: myOrg.operatingStatus,
        dailyCapacity: myOrg.dailyCapacity,
        requestMaterialTypes: selected,
      });
      setSelected([]);
      toast.success("Specialisation requests submitted for admin approval.");
      onUpdated();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Panel
        title="Material specialisations"
        description="Declare the material categories your institution handles. Pickups route only to active institutions with Approved specialisations."
      >
        {loadState === "loading" && (
          <p className="text-sm text-muted-foreground">Loading specialisations…</p>
        )}
        {loadState === "unavailable" && (
          <p className="text-sm text-muted-foreground">
            Specialisation management is not available.
          </p>
        )}
        {loadState === "ready" && !myOrg && (
          <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            No institution profile linked yet.
            <div className="mt-3">
              <Button size="sm" onClick={onOpenSettings}>
                <Settings /> Register or configure institution
              </Button>
            </div>
          </div>
        )}
        {loadState === "ready" && myOrg && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {MATERIAL_TYPES.map((mt) => {
                const existing = declaredMap.get(mt.id);
                const isQueued = selected.includes(mt.id);
                const canRequest =
                  !existing || existing.status === "rejected" || existing.status === "suspended";
                return (
                  <div
                    key={mt.id}
                    className={cn(
                      "rounded-2xl border p-4 text-sm",
                      isQueued ? "border-primary bg-mint/40" : "bg-card",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-display font-semibold">{mt.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{mt.parent}</p>
                      </div>
                      {existing ? (
                        <ApprovalBadge status={existing.status} />
                      ) : (
                        <Badge variant="muted">Not declared</Badge>
                      )}
                    </div>
                    {existing?.note && (
                      <p className="mt-2 text-xs text-muted-foreground">Note: {existing.note}</p>
                    )}
                    {canRequest && (
                      <label className="mt-3 flex cursor-pointer items-center gap-2 border-t pt-2.5 text-xs font-medium">
                        <Checkbox checked={isQueued} onCheckedChange={() => toggleNew(mt.id)} />
                        <span>{existing ? "Request re-approval" : "Request specialisation"}</span>
                      </label>
                    )}
                  </div>
                );
              })}
            </div>

            {selected.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-mint p-4 text-sm text-mint-foreground">
                <span>
                  {selected.length} material{selected.length === 1 ? "" : "s"} queued for admin
                  review.
                </span>
                <Button type="button" disabled={busy} onClick={submitRequests}>
                  Submit specialisation request{selected.length === 1 ? "" : "s"}
                </Button>
              </div>
            )}
          </div>
        )}
      </Panel>

      {institutions.length > 0 && (
        <Panel
          title="Registered institutions & specialisations"
          description="Multiple institutions may share overlapping approved specialisations."
        >
          <ul className="divide-y rounded-2xl border">
            {institutions.map((org) => (
              <li key={org.id} className="space-y-2 p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">
                    {org.name}{" "}
                    <span className="text-xs font-normal capitalize text-muted-foreground">
                      ({org.kind} · {org.area})
                    </span>
                  </span>
                  <Badge
                    variant={org.status === "active" ? "success" : "muted"}
                    className="capitalize"
                  >
                    {org.status}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {org.specialisations.length === 0 ? (
                    <span className="text-xs text-muted-foreground">
                      No specialisations declared
                    </span>
                  ) : (
                    org.specialisations.map((sp) => (
                      <span
                        key={`${org.id}-${sp.materialType}`}
                        className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs"
                      >
                        {materialTypeName(sp.materialType)}
                        <ApprovalBadge status={sp.status} />
                      </span>
                    ))
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}

function HubSettingsSection({
  myOrg,
  loadState,
  onSaved,
}: {
  myOrg: Institution | null;
  loadState: "loading" | "ready" | "unavailable";
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"hub" | "processor">("hub");
  const [phone, setPhone] = useState(myOrg?.phone ?? "");
  const [address, setAddress] = useState(myOrg?.address ?? "");
  const [area, setArea] = useState(myOrg?.area ?? AREAS[0]!);
  const [serviceAreas, setServiceAreas] = useState<string[]>(myOrg?.serviceAreas ?? []);
  const [operatingStatus, setOperatingStatus] = useState<OperatingStatus>(
    myOrg?.operatingStatus ?? "accepting",
  );
  const [dailyCapacity, setDailyCapacity] = useState(
    myOrg?.dailyCapacity != null ? String(myOrg.dailyCapacity) : "",
  );
  const [initialMaterials, setInitialMaterials] = useState<MaterialTypeId[]>(["pet"]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (myOrg) {
      setPhone(myOrg.phone);
      setAddress(myOrg.address);
      setArea(myOrg.area);
      setServiceAreas(myOrg.serviceAreas);
      setOperatingStatus(myOrg.operatingStatus);
      setDailyCapacity(myOrg.dailyCapacity != null ? String(myOrg.dailyCapacity) : "");
    }
  }, [myOrg]);

  const toggleArea = (a: string) => {
    setServiceAreas((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  };

  const toggleInitMaterial = (id: MaterialTypeId) => {
    setInitialMaterials((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const cap = dailyCapacity.trim() ? Number(dailyCapacity) : null;
      if (myOrg) {
        await updateInstitutionSettings(myOrg.id, {
          phone: phone.trim(),
          address: address.trim(),
          area,
          serviceAreas,
          operatingStatus,
          dailyCapacity: cap,
          requestMaterialTypes: [],
        });
        toast.success("Institution settings saved.");
      } else {
        if (name.trim().length < 2) {
          toast.error("Enter an institution name");
          return;
        }
        await registerInstitution({
          name: name.trim(),
          kind,
          phone: phone.trim(),
          address: address.trim(),
          area,
          serviceAreas: serviceAreas.length ? serviceAreas : [area],
          dailyCapacity: cap,
          materialTypes: initialMaterials,
        });
        toast.success("Institution registered for verification.");
      }
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (loadState === "loading") {
    return <p className="text-sm text-muted-foreground">Loading institution settings…</p>;
  }
  if (loadState === "unavailable") {
    return <p className="text-sm text-muted-foreground">Institution settings are not available.</p>;
  }

  return (
    <Panel
      title={myOrg ? "Institution settings & capacity" : "Register institution"}
      description={
        myOrg
          ? "Configure covered service areas, daily pickup capacity and operating status."
          : "Register a hub or processor organisation for platform verification."
      }
    >
      <form onSubmit={saveSettings} className="space-y-4">
        {!myOrg && (
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium">
              Institution name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Kanifing Recycling Hub"
                className={inputCls}
              />
            </label>
            <label className="text-sm font-medium">
              Type
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as "hub" | "processor")}
                className={inputCls}
              >
                <option value="hub">Recycling Hub</option>
                <option value="processor">Processor</option>
              </select>
            </label>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium">
            Phone
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+220…"
              className={inputCls}
            />
          </label>
          <label className="text-sm font-medium">
            Primary area
            <select value={area} onChange={(e) => setArea(e.target.value)} className={inputCls}>
              {AREAS.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium md:col-span-2">
            Street address
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Compound or facility address"
              className={inputCls}
            />
          </label>
          <label className="text-sm font-medium">
            Daily pickup capacity (leave blank for unlimited)
            <input
              inputMode="numeric"
              value={dailyCapacity}
              onChange={(e) => setDailyCapacity(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="e.g. 25"
              className={inputCls}
            />
          </label>
          {myOrg && (
            <label className="text-sm font-medium">
              Operating status
              <select
                value={operatingStatus}
                onChange={(e) => setOperatingStatus(e.target.value as OperatingStatus)}
                className={inputCls}
              >
                <option value="accepting">Accepting requests</option>
                <option value="paused">Paused</option>
                <option value="closed">Closed</option>
              </select>
            </label>
          )}
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Covered service areas</p>
          <div className="flex flex-wrap gap-2">
            {AREAS.map((a) => {
              const on = serviceAreas.includes(a);
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => toggleArea(a)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium",
                    on
                      ? "border-primary bg-mint text-mint-foreground"
                      : "bg-card text-muted-foreground",
                  )}
                >
                  <MapPin className="size-3" /> {a}
                </button>
              );
            })}
          </div>
        </div>

        {!myOrg && (
          <div>
            <p className="mb-2 text-sm font-medium">Initial material specialisations</p>
            <div className="flex flex-wrap gap-2">
              {MATERIAL_TYPES.map((mt) => {
                const on = initialMaterials.includes(mt.id);
                return (
                  <button
                    key={mt.id}
                    type="button"
                    onClick={() => toggleInitMaterial(mt.id)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium",
                      on
                        ? "border-primary bg-mint text-mint-foreground"
                        : "bg-card text-muted-foreground",
                    )}
                  >
                    {mt.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <Button type="submit" disabled={busy}>
          {myOrg ? "Save settings" : "Register institution"}
        </Button>
      </form>
    </Panel>
  );
}
