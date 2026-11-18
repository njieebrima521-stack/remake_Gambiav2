import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronRight, CloudOff, LocateFixed, MapPin, Phone, Play, Square } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, PickupStatusBadge } from "@/components/remake/ui";
import { useRemake } from "@/lib/remake/store";
import { MATERIALS } from "@/lib/remake/data";
import { RouteMap } from "@/components/remake/RouteMap";
import { fmtShortDate } from "@/lib/remake/format";
import { errorMessage } from "@/lib/remake/logic";
import { getDevicePosition } from "@/lib/remake/services/locations";
import {
  endShift,
  getMyPresence,
  sendLocation,
  setDutyStatus,
  startShift,
  type CollectorDutyStatus,
  type CollectorPresence,
} from "@/lib/remake/services/tracking";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/collector/today")({
  head: () => ({
    meta: [
      { title: "Collection Route — Remake" },
      {
        name: "description",
        content: "Assigned collection stops in order on a live map, with addresses and materials.",
      },
      { property: "og:title", content: "Collection Route — Remake" },
      { property: "og:description", content: "Today's Remake collection route." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RoutePage,
});

function RoutePage() {
  const { state } = useRemake();
  const [show, setShow] = useState<"open" | "all">("open");
  const [presence, setPresence] = useState<CollectorPresence | null>(null);
  const [presenceReady, setPresenceReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getMyPresence()
      .then((p) => {
        setPresence(p);
        setPresenceReady(true);
      })
      .catch(() => {
        setPresenceReady(false);
      });
  }, []);

  const onShift = !!presence?.sharing && presence.status !== "offline";

  const toggleShift = async () => {
    setBusy(true);
    try {
      if (onShift) {
        await endShift();
        toast.success("Shift ended.");
      } else {
        await startShift();
        toast.success("Shift started.");
      }
      setPresence(await getMyPresence());
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const pingGps = async () => {
    setBusy(true);
    try {
      const pos = await getDevicePosition();
      await sendLocation(pos.lat, pos.lng, pos.accuracyM);
      setPresence(await getMyPresence());
      toast.success("Position updated.");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (status: CollectorDutyStatus) => {
    setBusy(true);
    try {
      await setDutyStatus(status);
      setPresence(await getMyPresence());
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const stops = state.pickups
    .filter((p) => p.assignedToMe && (show === "all" || p.status === "scheduled"))
    .sort((a, b) => a.date.localeCompare(b.date) || a.slot.localeCompare(b.slot));
  const areas = Array.from(new Set(stops.map((s) => s.area)));
  return (
    <div>
      <PageHeader
        eyebrow="Collector"
        title="Assigned route"
        description={`Route covers ${areas.join(" → ") || "no areas yet"}`}
        actions={
          presenceReady && (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={onShift ? "success" : "muted"}>
                {onShift ? presence?.status.replace("_", " ") : "Offline"}
              </Badge>
              <Button
                size="sm"
                variant={onShift ? "destructive" : "default"}
                disabled={busy}
                onClick={toggleShift}
              >
                {onShift ? <Square /> : <Play />}
                {onShift ? "End shift" : "Start shift"}
              </Button>
              {onShift && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      setStatus(presence?.status === "on_pickup" ? "on_duty" : "on_pickup")
                    }
                  >
                    {presence?.status === "on_pickup" ? "Mark On Duty" : "Mark On Pickup"}
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy} onClick={pingGps}>
                    <LocateFixed /> Ping GPS
                  </Button>
                </>
              )}
            </div>
          )
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Panel
          title={`${stops.length} stops`}
          action={
            <div className="flex flex-wrap gap-1.5">
              {(["open", "all"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setShow(k)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold",
                    show === k ? "bg-ink text-ink-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  {k === "open" ? "Open" : "All"}
                </button>
              ))}
            </div>
          }
        >
          <ol className="space-y-3">
            {stops.map((p, i) => (
              <li key={p.id}>
                <Link
                  to="/collector/stops/$id"
                  params={{ id: p.id }}
                  className="flex items-center gap-4 rounded-2xl border p-4 transition hover:border-primary/40 hover:shadow-card"
                >
                  <span className="grid size-10 place-items-center rounded-full bg-primary font-display font-bold text-primary-foreground">
                    {i + 1}
                  </span>
                  <img
                    src={MATERIALS[p.material].image}
                    alt=""
                    className="hidden size-12 rounded-xl object-cover sm:block"
                    loading="lazy"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{p.customer}</p>
                    <p className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="size-3.5" />
                      {p.address}, {p.area}
                    </p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Phone className="size-3" />
                      {p.phone} · {fmtShortDate(p.date)} {p.slot}
                    </p>
                  </div>
                  {p.unsynced && <CloudOff className="size-4 text-warning" />}
                  <PickupStatusBadge status={p.status} />
                  <ChevronRight className="size-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
            {stops.length === 0 && (
              <li className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                Route complete.
              </li>
            )}
          </ol>
        </Panel>
        <Panel
          title="Route map"
          description="Your stops in order and where you are now"
          className="lg:sticky lg:top-24 lg:self-start"
        >
          <RouteMap
            stops={stops.map((p) => ({
              ref: p.id,
              customer: p.customer,
              address: p.address,
              area: p.area,
              when: `${fmtShortDate(p.date)} · ${p.slot}`,
              open: p.status === "scheduled",
            }))}
          />
        </Panel>
      </div>
    </div>
  );
}
