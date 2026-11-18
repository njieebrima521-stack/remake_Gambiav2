import { createFileRoute, Link } from "@tanstack/react-router";
import { Leaf, Recycle, Repeat, Scale } from "lucide-react";
import { Pie, PieChart, ResponsiveContainer, Cell, Tooltip } from "recharts";
import { EmptyState, PageHeader, Panel, PickupStatusBadge, StatCard } from "@/components/remake/ui";
import { Button } from "@/components/ui/button";
import { useRemake } from "@/lib/remake/store";
import { CO2_PER_KG, MATERIALS } from "@/lib/remake/data";
import { fmtDate, fmtKg } from "@/lib/remake/format";

export const Route = createFileRoute("/_authenticated/business/")({
  head: () => ({
    meta: [
      { title: "Business Dashboard — Remake" },
      {
        name: "description",
        content:
          "Green Score, recurring pickups and material statistics for Remake business partners.",
      },
      { property: "og:title", content: "Business Dashboard — Remake" },
      { property: "og:description", content: "Your business recycling performance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BusinessDashboard,
});

function BusinessDashboard() {
  const { state } = useRemake();
  const org = state.me?.orgs.find((o) => o.kind === "business");
  const mine = state.pickups
    .filter((p) => p.mineBusiness)
    .sort((a, b) => b.date.localeCompare(a.date));
  const year = new Date().getFullYear().toString();
  const kg = mine
    .filter((p) => (p.collectedAt ?? p.date).startsWith(year))
    .reduce((s, p) => s + (p.weightKg ?? 0), 0);
  const recurring = mine.filter((p) => p.recurring && p.status === "scheduled");
  const verified = mine.filter((p) => p.status === "verified" && p.weightKg);
  const weighed = verified.reduce((s, p) => s + (p.weightKg ?? 0), 0);
  // Green Score = share of your weighed waste that processors accepted (verified collections only).
  const score =
    weighed > 0
      ? Math.round((verified.reduce((s, p) => s + (p.acceptedKg ?? 0), 0) / weighed) * 100)
      : null;
  const byMat = Object.values(MATERIALS)
    .map((m, i) => ({
      name: m.name,
      kg: mine.filter((p) => p.material === m.id).reduce((s, p) => s + (p.weightKg ?? 0), 0),
      fill: `var(--chart-${(i % 5) + 1})`,
    }))
    .filter((x) => x.kg > 0);
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={org?.name ?? "Business"}
        title="Business dashboard"
        description={`Your recycling performance${org?.area ? ` across ${org.area}` : ""}.`}
        actions={
          <Button asChild>
            <Link to="/business/pickups">
              <Repeat /> Schedule pickup
            </Link>
          </Button>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_2fr]">
        <section className="rounded-3xl bg-gradient-ink p-6 text-ink-foreground shadow-lift">
          <p className="text-sm text-ink-muted">Green Score</p>
          <div className="mt-4 flex items-end gap-2">
            <p className="font-display text-6xl font-semibold">{score ?? "—"}</p>
            <p className="mb-2 text-ink-muted">/100</p>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-ink-foreground/15">
            <div className="h-full rounded-full bg-primary" style={{ width: `${score ?? 0}%` }} />
          </div>
          <p className="mt-4 text-sm text-ink-muted">
            {score === null
              ? "Your score appears after a processor verifies your first collection."
              : "Share of your weighed waste accepted by processors. Separate materials cleanly to raise it."}
          </p>
        </section>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Diverted this year"
            value={fmtKg(kg)}
            sub="Weighed by collectors"
            icon={Scale}
            tone="brand"
          />
          <StatCard
            label="CO₂e avoided"
            value={`${((kg * CO2_PER_KG) / 1000).toFixed(2)} t`}
            sub={`Estimate · ${CO2_PER_KG} kg CO₂e per kg`}
            icon={Leaf}
          />
          <StatCard
            label="Recurring pickups"
            value={recurring.length}
            sub="Upcoming"
            icon={Recycle}
          />
        </div>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Material statistics">
          {byMat.length === 0 ? (
            <EmptyState icon={Scale} title="No weighed collections yet" />
          ) : (
            <div className="grid items-center gap-4 sm:grid-cols-2">
              <div className="h-56">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={byMat} dataKey="kg" nameKey="name" innerRadius={55} outerRadius={90}>
                      {byMat.map((d) => (
                        <Cell key={d.name} fill={d.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="space-y-2 text-sm">
                {byMat.map((d) => (
                  <li key={d.name} className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span className="size-2.5 rounded-full" style={{ backgroundColor: d.fill }} />
                      {d.name}
                    </span>
                    <b>{fmtKg(d.kg)}</b>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>
        <Panel
          title="Collection history"
          action={
            <Link
              to="/business/pickups"
              className="text-sm font-semibold text-primary hover:underline"
            >
              All
            </Link>
          }
        >
          {mine.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No pickups yet. Schedule your first recurring pickup.
            </p>
          )}
          <ul className="divide-y">
            {mine.slice(0, 5).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <span>
                  <b>{MATERIALS[p.material].name}</b> · {p.bags} bags{" "}
                  {p.weightKg ? `· ${fmtKg(p.weightKg)}` : ""}
                  <br />
                  <span className="text-muted-foreground">{fmtDate(p.date)}</span>
                </span>
                <PickupStatusBadge status={p.status} />
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
