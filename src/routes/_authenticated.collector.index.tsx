import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import {
  Building2,
  Check,
  CloudOff,
  CloudUpload,
  LocateFixed,
  MapPin,
  Play,
  Scale,
  Square,
  Truck,
  Wallet,
  Wifi,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { PageHeader, Panel, PickupStatusBadge, StatCard } from "@/components/remake/ui";
import { useRemake } from "@/lib/remake/store";
import { MATERIALS } from "@/lib/remake/data";
import { errorMessage } from "@/lib/remake/logic";
import { fmtGmd, fmtKg } from "@/lib/remake/format";
import { materialTypeName } from "@/lib/remake/material-types";
import {
  listInstitutions,
  listMemberships,
  requestMembership,
  respondToInvitation,
  type CollectorMembership,
  type Institution,
} from "@/lib/remake/services/institutions";
import { getDevicePosition } from "@/lib/remake/services/locations";
import {
  endShift,
  getMyPresence,
  isStale,
  listShifts,
  sendLocation,
  setDutyStatus,
  startShift,
  type CollectorDutyStatus,
  type CollectorPresence,
  type ShiftRecord,
} from "@/lib/remake/services/tracking";

export const Route = createFileRoute("/_authenticated/collector/")({
  head: () => ({
    meta: [
      { title: "Collector Dashboard — Remake" },
      {
        name: "description",
        content:
          "Today's collection jobs, shift controls, institution memberships, earnings and offline sync for Remake collectors.",
      },
      { property: "og:title", content: "Collector Dashboard — Remake" },
      { property: "og:description", content: "Run your Remake collection route." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CollectorDashboard,
});

function CollectorDashboard() {
  const { state, setOffline, sync } = useRemake();
  const mine = state.pickups.filter((p) => p.assignedToMe);
  const rate = state.settings.collectorRateGmdPerKg;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const todo = mine
    .filter((p) => p.status === "scheduled")
    .sort((a, b) => a.date.localeCompare(b.date) || a.slot.localeCompare(b.slot));
  const done = mine.filter((p) => p.weightKg);
  const rejected = mine.filter((p) => p.status === "rejected");
  const kg = done.reduce((s, p) => s + (p.weightKg ?? 0), 0);
  const unsynced = state.pickups.filter((p) => p.unsynced).length;

  const [presence, setPresence] = useState<CollectorPresence | null>(null);
  const [presenceState, setPresenceState] = useState<"loading" | "ready" | "unavailable">(
    "loading",
  );
  const [shiftBusy, setShiftBusy] = useState(false);
  const [memberships, setMemberships] = useState<CollectorMembership[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [memState, setMemState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [shifts, setShifts] = useState<ShiftRecord[]>([]);
  const [shiftsState, setShiftsState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [joinOrgId, setJoinOrgId] = useState("");
  const [memBusy, setMemBusy] = useState(false);
  const watchRef = useRef<number | null>(null);

  const loadCollectorExtras = useCallback(() => {
    getMyPresence()
      .then((p) => {
        setPresence(p);
        setPresenceState("ready");
      })
      .catch(() => {
        setPresenceState("unavailable");
      });

    Promise.all([listMemberships(), listInstitutions()])
      .then(([mems, orgs]) => {
        setMemberships(mems);
        setInstitutions(orgs.filter((o) => o.kind === "hub"));
        setMemState("ready");
      })
      .catch(() => {
        setMemState("unavailable");
      });

    listShifts()
      .then((rows) => {
        setShifts(rows);
        setShiftsState("ready");
      })
      .catch(() => {
        setShiftsState("unavailable");
      });
  }, []);

  useEffect(() => {
    loadCollectorExtras();
  }, [loadCollectorExtras]);

  // While on shift and sharing, periodically forward device coordinates while tab stays open.
  useEffect(() => {
    if (!presence?.sharing || presence.status === "offline") {
      if (watchRef.current !== null && "geolocation" in navigator) {
        navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = null;
      }
      return;
    }
    if (!("geolocation" in navigator)) return;
    let lastSent = 0;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastSent < 15_000) return;
        lastSent = now;
        void sendLocation(
          pos.coords.latitude,
          pos.coords.longitude,
          Math.round(pos.coords.accuracy),
        )
          .then(() =>
            setPresence((prev) =>
              prev
                ? {
                    ...prev,
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    accuracyM: Math.round(pos.coords.accuracy),
                    updatedAt: new Date().toISOString(),
                  }
                : prev,
            ),
          )
          .catch(() => {
            /* ignore background send errors */
          });
      },
      () => {
        /* permission/availability errors handled when collector taps Ping Location */
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 25_000 },
    );
    watchRef.current = id;
    return () => {
      navigator.geolocation.clearWatch(id);
      watchRef.current = null;
    };
  }, [presence?.sharing, presence?.status]);

  const doSync = async () => {
    try {
      const n = await sync();
      toast.success(`Synced ${n} record${n === 1 ? "" : "s"}`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const toggleShift = async () => {
    setShiftBusy(true);
    try {
      if (presence?.sharing && presence.status !== "offline") {
        await endShift();
        toast.success("Shift ended.");
      } else {
        await startShift();
        toast.success("Shift started.");
      }
      const next = await getMyPresence();
      setPresence(next);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setShiftBusy(false);
    }
  };

  const changeDutyStatus = async (status: CollectorDutyStatus) => {
    setShiftBusy(true);
    try {
      await setDutyStatus(status);
      const next = await getMyPresence();
      setPresence(next);
      toast.success(`Status: ${status.replace("_", " ")}`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setShiftBusy(false);
    }
  };

  const pingLocation = async () => {
    setShiftBusy(true);
    try {
      const pos = await getDevicePosition();
      await sendLocation(pos.lat, pos.lng, pos.accuracyM);
      const next = await getMyPresence();
      setPresence(next);
      toast.success(`Location sent (±${pos.accuracyM} m)`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setShiftBusy(false);
    }
  };

  const sendJoinRequest = async () => {
    if (!joinOrgId) return;
    setMemBusy(true);
    try {
      await requestMembership(joinOrgId);
      setJoinOrgId("");
      toast.success("Membership request sent.");
      loadCollectorExtras();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setMemBusy(false);
    }
  };

  const answerInvite = async (membershipId: string, accept: boolean) => {
    setMemBusy(true);
    try {
      await respondToInvitation(membershipId, accept);
      toast.success(accept ? "Invitation accepted." : "Invitation declined.");
      loadCollectorExtras();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setMemBusy(false);
    }
  };

  const onShift = !!presence?.sharing && presence.status !== "offline";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Collector"
        title={`${greeting}, ${state.profile.name.split(" ")[0] || "collector"}`}
        description="Your jobs update live when residents and businesses book pickups."
        actions={
          <Button asChild>
            <Link to="/collector/today">
              <MapPin /> Start route
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Open stops"
          value={todo.length}
          sub="Assigned to you"
          icon={Truck}
          tone="brand"
        />
        <StatCard
          label="Weighed"
          value={fmtKg(kg)}
          sub={`${done.length} collections`}
          icon={Scale}
        />
        <StatCard
          label="Earnings"
          value={fmtGmd(kg * rate)}
          sub={`GMD ${rate}/kg · estimate`}
          icon={Wallet}
        />
        <StatCard
          label="Unsynced records"
          value={unsynced}
          sub={state.collectorOffline ? "Offline mode on" : "All caught up"}
          icon={state.collectorOffline ? CloudOff : Wifi}
          tone={unsynced ? "ink" : "default"}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Panel
          title="Next stops"
          action={
            <Link
              to="/collector/today"
              className="text-sm font-semibold text-primary hover:underline"
            >
              Full route
            </Link>
          }
        >
          {todo.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No open stops. New bookings will appear here.
            </p>
          ) : (
            <ul className="divide-y">
              {todo.slice(0, 5).map((p, i) => (
                <li key={p.id}>
                  <Link
                    to="/collector/stops/$id"
                    params={{ id: p.id }}
                    className="flex items-center gap-4 py-3 hover:bg-muted/40"
                  >
                    <span className="grid size-9 place-items-center rounded-full bg-ink font-display text-sm font-bold text-ink-foreground">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{p.customer}</p>
                      <p className="text-sm text-muted-foreground">
                        {p.address}, {p.area} · {p.slot}
                      </p>
                    </div>
                    <span className="hidden text-sm sm:block">
                      {MATERIALS[p.material].name} · {p.bags} bags
                    </span>
                    <PickupStatusBadge status={p.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="space-y-6">
          <Panel
            title="Shift & live location"
            action={
              presenceState === "ready" && (
                <Badge variant={onShift ? "success" : "muted"}>
                  {onShift ? presence.status.replace("_", " ") : "Offline"}
                </Badge>
              )
            }
          >
            {presenceState === "loading" && (
              <p className="text-sm text-muted-foreground">Loading shift status…</p>
            )}
            {presenceState === "unavailable" && (
              <p className="text-sm text-muted-foreground">Shift tracking not available.</p>
            )}
            {presenceState === "ready" && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={onShift ? "destructive" : "default"}
                    disabled={shiftBusy}
                    onClick={toggleShift}
                    className="flex-1"
                  >
                    {onShift ? <Square /> : <Play />}
                    {onShift ? "End Shift" : "Start Shift"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={shiftBusy || !onShift}
                    onClick={pingLocation}
                  >
                    <LocateFixed /> Update GPS
                  </Button>
                </div>

                {onShift && (
                  <div className="flex flex-wrap gap-1.5">
                    {(["on_duty", "on_pickup", "offline"] as CollectorDutyStatus[]).map((st) => (
                      <button
                        key={st}
                        type="button"
                        disabled={shiftBusy}
                        onClick={() => changeDutyStatus(st)}
                        className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
                          presence?.status === st
                            ? "bg-ink text-ink-foreground"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {st.replace("_", " ")}
                      </button>
                    ))}
                  </div>
                )}

                <div className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
                  {presence?.updatedAt ? (
                    <p>
                      Last update: {format(new Date(presence.updatedAt), "d MMM HH:mm")}
                      {isStale(presence.updatedAt) ? " (stale)" : ""}
                      {presence.lat !== null && presence.lng !== null
                        ? ` · ${presence.lat.toFixed(4)}, ${presence.lng.toFixed(4)}`
                        : ""}
                    </p>
                  ) : (
                    <p>No location sent yet.</p>
                  )}
                  <p className="mt-1">
                    Live coordinates update only while your shift is active and this browser tab is
                    open.
                  </p>
                </div>
              </div>
            )}
          </Panel>

          <Panel title="Offline & sync">
            <div className="flex items-center justify-between rounded-2xl border p-4">
              <div className="flex items-center gap-3">
                {state.collectorOffline ? (
                  <CloudOff className="text-warning" />
                ) : (
                  <Wifi className="text-primary" />
                )}
                <div>
                  <p className="font-semibold">
                    {state.collectorOffline ? "Offline mode" : "Online"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Turn on when the network is weak on the route
                  </p>
                </div>
              </div>
              <Switch
                checked={state.collectorOffline}
                onCheckedChange={setOffline}
                aria-label="Offline mode"
              />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Records captured offline are saved on this device and marked <b>unsynced</b> until you
              sync. Photos can only be attached online.
            </p>
            <Button
              className="mt-4 w-full"
              variant="ink"
              disabled={unsynced === 0 && !state.collectorOffline}
              onClick={doSync}
            >
              <CloudUpload /> Sync now {unsynced > 0 && `(${unsynced})`}
            </Button>
          </Panel>
        </div>
      </div>

      <Panel
        title="Institution memberships & permissions"
        description="Material permissions are inherited from your institution's approved specialisations minus any individual restrictions."
      >
        {memState === "loading" && (
          <p className="text-sm text-muted-foreground">Loading memberships…</p>
        )}
        {memState === "unavailable" && (
          <p className="text-sm text-muted-foreground">Institution memberships not available.</p>
        )}
        {memState === "ready" && (
          <div className="space-y-4">
            {memberships.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                You are not linked to any institution yet. Request to join a hub below.
              </p>
            ) : (
              <ul className="divide-y rounded-2xl border">
                {memberships.map((m) => (
                  <li key={m.id} className="space-y-2 p-4 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Building2 className="size-4 text-primary" />
                        <span className="font-semibold">{m.orgName}</span>
                      </div>
                      <Badge
                        variant={
                          m.status === "approved"
                            ? "success"
                            : m.status === "invited" || m.status === "requested"
                              ? "warning"
                              : "muted"
                        }
                        className="capitalize"
                      >
                        {m.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Allowed materials:{" "}
                      {m.permissions.length
                        ? m.permissions.map((p) => materialTypeName(p)).join(", ")
                        : "None"}
                    </p>
                    {m.restrictions.length > 0 && (
                      <p className="text-xs text-destructive">
                        Restrictions: {m.restrictions.map((r) => materialTypeName(r)).join(", ")}
                      </p>
                    )}
                    {m.status === "invited" && (
                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          disabled={memBusy}
                          onClick={() => answerInvite(m.id, true)}
                        >
                          <Check /> Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={memBusy}
                          onClick={() => answerInvite(m.id, false)}
                        >
                          <X /> Decline
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {institutions.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <select
                  value={joinOrgId}
                  onChange={(e) => setJoinOrgId(e.target.value)}
                  className="h-10 min-w-56 flex-1 rounded-xl border bg-card px-3 text-sm"
                  aria-label="Choose institution to join"
                >
                  <option value="">Request to join an institution…</option>
                  {institutions.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name} ({org.area})
                    </option>
                  ))}
                </select>
                <Button type="button" disabled={!joinOrgId || memBusy} onClick={sendJoinRequest}>
                  Request membership
                </Button>
              </div>
            )}
          </div>
        )}
      </Panel>

      <Panel
        title="Collector profile & activity"
        description={`${state.profile.name || "Collector"} · ${state.profile.area}${state.profile.phone ? ` · ${state.profile.phone}` : ""}`}
      >
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border p-3 text-sm">
            <p className="text-xs text-muted-foreground">Completed collections</p>
            <p className="mt-1 font-display text-xl font-semibold">{done.length}</p>
          </div>
          <div className="rounded-xl border p-3 text-sm">
            <p className="text-xs text-muted-foreground">Rejected pickups</p>
            <p className="mt-1 font-display text-xl font-semibold">{rejected.length}</p>
          </div>
          <div className="rounded-xl border p-3 text-sm">
            <p className="text-xs text-muted-foreground">Total weighed</p>
            <p className="mt-1 font-display text-xl font-semibold">{fmtKg(kg)}</p>
          </div>
        </div>
        {shiftsState === "loading" && (
          <p className="text-sm text-muted-foreground">Loading shift history…</p>
        )}
        {shiftsState === "unavailable" && (
          <p className="text-sm text-muted-foreground">Shift history not available.</p>
        )}
        {shiftsState === "ready" && (
          <>
            {shifts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No shifts recorded yet.</p>
            ) : (
              <ul className="divide-y rounded-2xl border">
                {shifts.slice(0, 8).map((sh) => (
                  <li
                    key={sh.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm"
                  >
                    <span>
                      <b>{format(new Date(sh.startedAt), "d MMM yyyy HH:mm")}</b>
                      {sh.endedAt ? (
                        <span className="text-muted-foreground">
                          {" "}
                          → {format(new Date(sh.endedAt), "HH:mm")}
                        </span>
                      ) : (
                        <span className="ml-2 text-xs font-semibold text-primary">Active</span>
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {sh.updates} GPS update{sh.updates === 1 ? "" : "s"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Panel>
    </div>
  );
}
