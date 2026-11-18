import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BookOpen,
  CalendarClock,
  Gift,
  Hourglass,
  Leaf,
  ScanLine,
  Scale,
  Sparkles,
  Trash2,
  Truck,
  ArrowRight,
} from "lucide-react";
import { useRemake } from "@/lib/remake/store";
import { MATERIALS, todayIso } from "@/lib/remake/data";
import { fmtDate, fmtKg, fmtNum, fmtShortDate } from "@/lib/remake/format";
import { PointsCard } from "@/components/remake/PointsCard";
import { WorkflowTracker } from "@/components/remake/WorkflowTracker";
import { EmptyState, Panel, PickupStatusBadge, StatCard } from "@/components/remake/ui";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/resident/")({
  head: () => ({
    meta: [
      { title: "Resident Dashboard — Remake" },
      {
        name: "description",
        content:
          "Your Green Coins, pending points, Clean Stream Score, recycled weight and upcoming pickups.",
      },
      { property: "og:title", content: "Resident Dashboard — Remake" },
      { property: "og:description", content: "Track your recycling and Green Coins with Remake." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResidentDashboard,
});

const QUICK = [
  { to: "/resident/scan", label: "Scan waste", icon: ScanLine },
  { to: "/resident/pickups", label: "Book pickup", icon: Truck },
  { to: "/resident/guide", label: "Guide", icon: BookOpen },
  { to: "/resident/rewards", label: "Rewards", icon: Gift },
] as const;

function ResidentDashboard() {
  const { state } = useRemake();
  const mine = state.pickups.filter((p) => p.mine);
  const recycled = mine.reduce((s, p) => s + (p.weightKg ?? 0), 0);
  const verified = mine.filter((p) => p.status === "verified" && p.weightKg);
  const cleanScore = verified.length
    ? Math.round(
        (verified.reduce((s, p) => s + (p.acceptedKg ?? 0), 0) /
          verified.reduce((s, p) => s + (p.weightKg ?? 0), 0)) *
          100,
      )
    : 100;
  const upcoming = mine
    .filter((p) => p.status === "scheduled")
    .sort((a, b) => a.date.localeCompare(b.date));
  const byMaterial = Object.values(MATERIALS)
    .map((m) => ({
      m,
      kg: mine.filter((p) => p.material === m.id).reduce((s, p) => s + (p.weightKg ?? 0), 0),
    }))
    .filter((x) => x.kg > 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <section className="relative overflow-hidden rounded-3xl bg-gradient-brand p-7 text-primary-foreground shadow-glow">
          <Leaf className="absolute -right-6 -top-6 size-48 opacity-10" />
          <p className="text-sm opacity-90">{fmtDate(todayIso())}</p>
          <h1 className="mt-1 text-3xl font-semibold">
            Hello 👋 {state.profile.name.split(" ")[0]}
          </h1>
          <p className="mt-1 max-w-md opacity-90">
            You've kept {fmtKg(recycled)} of waste out of the dump site. Let's keep{" "}
            {state.profile.area || "The Gambia"} clean.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {QUICK.map((q) => (
              <Link
                key={q.to}
                to={q.to}
                className="group flex flex-col items-center gap-2 rounded-2xl bg-card p-4 text-center text-foreground transition hover:-translate-y-0.5 hover:shadow-lift"
              >
                <span className="grid size-12 place-items-center rounded-full bg-mint text-mint-foreground group-hover:bg-primary group-hover:text-primary-foreground">
                  <q.icon className="size-5" />
                </span>
                <span className="text-sm font-semibold">{q.label}</span>
              </Link>
            ))}
          </div>
        </section>
        <PointsCard />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Green Coins"
          value={fmtNum(state.wallet.available)}
          sub="Available to spend"
          icon={Sparkles}
        />
        <StatCard
          label="Pending points"
          value={fmtNum(state.wallet.pending)}
          sub="Released after processor verification"
          icon={Hourglass}
        />
        <StatCard
          label="Clean Stream Score"
          value={`${cleanScore}/100`}
          sub="Share of your waste accepted by processors"
          icon={Leaf}
        />
        <StatCard
          label="Recycled weight"
          value={fmtKg(recycled)}
          sub={`${mine.length} pickup${mine.length === 1 ? "" : "s"} since joining`}
          icon={Scale}
        />
      </div>

      <WorkflowTracker />

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Panel
          title="Upcoming pickups"
          description="Have your bags ready and show your QR code to the collector."
          action={
            <Link
              to="/resident/pickups"
              className="text-sm font-semibold text-primary hover:underline"
            >
              Manage
            </Link>
          }
        >
          {upcoming.length === 0 ? (
            <EmptyState icon={CalendarClock} title="No pickups scheduled">
              <Link to="/resident/pickups" className="font-semibold text-primary">
                Book a pickup
              </Link>{" "}
              to get your recyclables collected.
            </EmptyState>
          ) : (
            <ul className="divide-y">
              {upcoming.map((p) => (
                <li key={p.id} className="flex items-center gap-4 py-3">
                  <img
                    src={MATERIALS[p.material].image}
                    alt=""
                    className="size-12 rounded-xl object-cover"
                    loading="lazy"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {MATERIALS[p.material].name} · {p.bags} bags
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {fmtDate(p.date)} · {p.slot}
                    </p>
                  </div>
                  <PickupStatusBadge status={p.status} />
                </li>
              ))}
            </ul>
          )}
          {byMaterial.length > 0 && (
            <div className="mt-5 border-t pt-5">
              <p className="mb-3 text-sm font-semibold">Your recycling mix</p>
              <div className="flex h-3 overflow-hidden rounded-full bg-muted">
                {byMaterial.map((x, i) => (
                  <span
                    key={x.m.id}
                    style={{
                      width: `${(x.kg / recycled) * 100}%`,
                      backgroundColor: `var(--chart-${(i % 5) + 1})`,
                    }}
                  />
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                {byMaterial.map((x, i) => (
                  <span key={x.m.id} className="flex items-center gap-1.5">
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: `var(--chart-${(i % 5) + 1})` }}
                    />
                    {x.m.name} · {fmtKg(x.kg)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Panel>

        <Panel
          title="Recent activity"
          action={
            <Link
              to="/resident/rewards"
              hash="history"
              className="text-sm font-semibold text-primary hover:underline"
            >
              See all
            </Link>
          }
        >
          <ul className="space-y-3">
            {state.transactions.length === 0 && (
              <li className="rounded-2xl bg-muted p-4 text-sm text-muted-foreground">
                No coin activity yet. Book a pickup to start earning.
              </li>
            )}
            {state.transactions.slice(0, 5).map((t) => (
              <li
                key={t.id}
                className={cn(
                  "flex items-center gap-3 rounded-2xl p-3",
                  t.type === "earned" ? "bg-primary text-primary-foreground" : "bg-muted",
                )}
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-card text-foreground">
                  <Trash2
                    className={cn(
                      "size-5",
                      t.type === "earned" && "text-primary",
                      t.type === "pending" && "text-warning",
                      t.type === "redeemed" && "text-ink",
                    )}
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{t.label}</p>
                  <p
                    className={cn(
                      "text-xs",
                      t.type === "earned" ? "opacity-85" : "text-muted-foreground",
                    )}
                  >
                    {fmtShortDate(t.date)} · {t.type}
                  </p>
                </div>
                <span className="font-display text-sm font-semibold tabular">
                  {t.amount > 0 ? "+" : ""}
                  {fmtNum(t.amount)}
                </span>
              </li>
            ))}
          </ul>
          <Link
            to="/resident/scan"
            className="mt-4 flex items-center justify-center gap-1 text-sm font-semibold text-primary"
          >
            Scan new waste <ArrowRight className="size-4" />
          </Link>
        </Panel>
      </div>
    </div>
  );
}
