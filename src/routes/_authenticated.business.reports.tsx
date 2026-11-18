import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Download, Droplets, Leaf, TreePine } from "lucide-react";
import { format, startOfMonth, subMonths } from "date-fns";
import { toast } from "sonner";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, Simulated, StatCard } from "@/components/remake/ui";
import { useRemake } from "@/lib/remake/store";
import { CO2_PER_KG, WATER_L_PER_KG } from "@/lib/remake/data";

export const Route = createFileRoute("/_authenticated/business/reports")({
  head: () => ({
    meta: [
      { title: "Impact Reports — Remake Business" },
      {
        name: "description",
        content:
          "Monthly diversion, CO₂ savings and sustainability reporting for business partners.",
      },
      { property: "og:title", content: "Impact Reports — Remake Business" },
      {
        property: "og:description",
        content: "Sustainability impact of your recycling with Remake.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const { state } = useRemake();
  const [range, setRange] = useState<3 | 6>(6);
  const org = state.me?.orgs.find((o) => o.kind === "business");
  const mine = state.pickups.filter((p) => p.mineBusiness && p.weightKg);
  // Monthly weight from your own weighed collections (verified pickups use the processor-accepted weight).
  const data = Array.from({ length: range }, (_, i) => {
    const m = startOfMonth(subMonths(new Date(), range - 1 - i));
    const key = format(m, "yyyy-MM");
    const kg = mine
      .filter((p) => (p.collectedAt ?? p.date).startsWith(key))
      .reduce((s, p) => s + (p.status === "verified" ? (p.acceptedKg ?? 0) : (p.weightKg ?? 0)), 0);
    return { month: format(m, "MMM"), kg: Math.round(kg * 10) / 10 };
  });
  const total = data.reduce((s, d) => s + d.kg, 0);
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={org?.name ?? "Business"}
        title="Impact report"
        description="Built from your weighed and verified collections — ready to share with guests, investors and the Ministry of Environment."
        actions={
          <>
            <Simulated label="CO₂ & water are estimates" />
            <Button variant="outline" onClick={() => setRange(range === 6 ? 3 : 6)}>
              Last {range === 6 ? 3 : 6} months
            </Button>
            <Button
              onClick={() => {
                window.print();
                toast("Use your browser's print dialog to save as PDF");
              }}
            >
              <Download /> Export PDF
            </Button>
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Waste diverted"
          value={`${(total / 1000).toFixed(2)} t`}
          sub={`Last ${range} months`}
          icon={Leaf}
          tone="brand"
        />
        <StatCard
          label="CO₂e avoided"
          value={`${((total * CO2_PER_KG) / 1000).toFixed(2)} t`}
          sub={`Estimate · ${CO2_PER_KG} kg per kg recycled`}
          icon={TreePine}
        />
        <StatCard
          label="Water saved"
          value={`${Math.round(total * WATER_L_PER_KG).toLocaleString("en-GB")} L`}
          sub={`Estimate · ${WATER_L_PER_KG} L per kg`}
          icon={Droplets}
        />
      </div>
      <Panel title="Monthly diversion (kg)">
        {total === 0 && (
          <p className="mb-3 text-sm text-muted-foreground">
            No weighed collections in this period yet.
          </p>
        )}
        <div className="h-72">
          <ResponsiveContainer>
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Area
                dataKey="kg"
                stroke="var(--primary)"
                fill="var(--primary)"
                fillOpacity={0.2}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </div>
  );
}
