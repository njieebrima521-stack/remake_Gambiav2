import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Check,
  ScanLine,
  Truck,
  Scale,
  Boxes,
  Factory,
  Coins,
  Gift,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRemake } from "@/lib/remake/store";
import type { NavItem } from "./nav";

const STEPS: {
  key: string;
  label: string;
  who: string;
  icon: typeof ScanLine;
  to: NavItem["to"];
}[] = [
  { key: "scan", label: "Scan waste", who: "Resident", icon: ScanLine, to: "/resident/scan" },
  { key: "book", label: "Book pickup", who: "Resident", icon: Truck, to: "/resident/pickups" },
  { key: "weigh", label: "Record weight", who: "Collector", icon: Scale, to: "/collector" },
  { key: "batch", label: "Create batch", who: "Hub", icon: Boxes, to: "/hub" },
  { key: "verify", label: "Verify batch", who: "Processor", icon: Factory, to: "/processor" },
  {
    key: "points",
    label: "Points available",
    who: "Resident",
    icon: Coins,
    to: "/resident/rewards",
  },
  { key: "redeem", label: "Redeem reward", who: "Resident", icon: Gift, to: "/resident/rewards" },
];

export function useWorkflowProgress() {
  const { state } = useRemake();
  const p = state.pickups.find((x) => x.id === state.demoPickupId);
  const batch = p?.batchId ? state.batches.find((b) => b.id === p.batchId) : undefined;
  const redeemedAfter =
    p?.status === "verified" && state.redemptions.some((r) => r.date >= (p.createdAt ?? ""));
  const done = [
    !!state.lastScan || !!p,
    !!p,
    !!p && p.status !== "scheduled",
    !!p && (p.status === "batched" || p.status === "verified"),
    !!p && p.status === "verified",
    !!p && p.status === "verified",
    !!redeemedAfter,
  ];
  // Handover sits between batch and verify; surface it as a hint.
  const awaitingHandover = batch?.status === "ready";
  const current = done.findIndex((d) => !d);
  return { done, current: current === -1 ? STEPS.length : current, pickup: p, awaitingHandover };
}

export function WorkflowTracker({ className }: { className?: string }) {
  const { done, current, pickup, awaitingHandover } = useWorkflowProgress();
  const next = STEPS[current];
  const hint =
    current === 4 && awaitingHandover
      ? "Hub must hand the batch over to the processor first."
      : next
        ? `Next: ${next.who} — ${next.label.toLowerCase()}`
        : "Workflow complete — the full loop worked end to end.";

  return (
    <section className={cn("rounded-2xl border bg-card p-5 shadow-card", className)}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold">Recycling workflow</h2>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {pickup ? (
              <>
                Following pickup{" "}
                <span className="font-mono font-semibold text-foreground">{pickup.id}</span> ·{" "}
                {hint}
              </>
            ) : (
              "Start by scanning waste or booking a pickup."
            )}
          </p>
        </div>
        {next && (
          <Link
            to={awaitingHandover && current === 4 ? "/hub" : next.to}
            className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-3.5 py-2 text-sm font-semibold text-ink-foreground hover:bg-ink/90"
          >
            Go to {awaitingHandover && current === 4 ? "Hub" : next.who}{" "}
            <ArrowRight className="size-4" />
          </Link>
        )}
      </div>
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {STEPS.map((s, i) => {
          const isDone = done[i];
          const isCurrent = i === current;
          return (
            <li key={s.key}>
              <Link
                to={s.to}
                className={cn(
                  "flex h-full flex-col gap-2 rounded-xl border p-3 transition-colors",
                  isDone && "border-primary/30 bg-mint",
                  isCurrent && "border-primary ring-2 ring-primary/20",
                  !isDone && !isCurrent && "bg-muted/40 hover:bg-muted",
                )}
              >
                <span
                  className={cn(
                    "grid size-8 place-items-center rounded-lg",
                    isDone
                      ? "bg-primary text-primary-foreground"
                      : isCurrent
                        ? "bg-ink text-ink-foreground"
                        : "bg-card text-muted-foreground",
                  )}
                >
                  {isDone ? (
                    <Check className="size-4" strokeWidth={3} />
                  ) : (
                    <s.icon className="size-4" />
                  )}
                </span>
                <span className="text-[13px] font-semibold leading-tight">{s.label}</span>
                <span className="text-[11px] text-muted-foreground">{s.who}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
