import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Banknote, Clock, Loader2, Scale, Wallet } from "lucide-react";
import { endOfWeek, format, parseISO, startOfWeek, subWeeks } from "date-fns";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, StatCard } from "@/components/remake/ui";
import { useRemake } from "@/lib/remake/store";
import { fmtGmd, fmtKg, fmtShortDate } from "@/lib/remake/format";
import { collectorPayoutGmd, errorMessage } from "@/lib/remake/logic";
import type { PayoutStatus } from "@/lib/remake/types";

export const Route = createFileRoute("/_authenticated/collector/earnings")({
  head: () => ({
    meta: [
      { title: "Collector Earnings — Remake" },
      {
        name: "description",
        content: "GMD earnings per kilogram collected, payout requests and payout history.",
      },
      { property: "og:title", content: "Collector Earnings — Remake" },
      {
        property: "og:description",
        content: "Track your Remake collector earnings and payouts in GMD.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EarningsPage,
});

const PAYOUT_BADGE: Record<
  PayoutStatus,
  { label: string; variant: "warning" | "success" | "muted" }
> = {
  pending: { label: "Waiting to be paid", variant: "warning" },
  paid: { label: "Paid", variant: "success" },
  cancelled: { label: "Cancelled", variant: "muted" },
};

function EarningsPage() {
  const { state, requestPayout } = useRemake();
  const [busy, setBusy] = useState(false);
  const rate = state.settings.collectorRateGmdPerKg;
  const done = state.pickups
    .filter((p) => p.assignedToMe && p.weightKg && p.status !== "rejected")
    .sort((a, b) => (b.collectedAt ?? "").localeCompare(a.collectedAt ?? ""));
  const payoutById = new Map(state.payouts.map((o) => [o.uuid, o]));
  const unpaid = done.filter((p) => !p.payoutId && !p.unsynced);
  const unpaidKg = unpaid.reduce((s, p) => s + (p.weightKg ?? 0), 0);
  const unpaidGmd = collectorPayoutGmd(
    unpaid.map((p) => p.weightKg ?? 0),
    rate,
  );
  const waiting = state.payouts.filter((o) => o.status === "pending");
  const paid = state.payouts.filter((o) => o.status === "paid");
  const now = new Date();
  // Last five weeks (Mon–Sun) from recorded collections.
  const weeks = Array.from({ length: 5 }, (_, i) => {
    const start = startOfWeek(subWeeks(now, 4 - i), { weekStartsOn: 1 });
    const end = endOfWeek(start, { weekStartsOn: 1 });
    const kg = done
      .filter(
        (p) => p.collectedAt && parseISO(p.collectedAt) >= start && parseISO(p.collectedAt) <= end,
      )
      .reduce((s, p) => s + (p.weightKg ?? 0), 0);
    return { w: i === 4 ? "This wk" : format(start, "d MMM"), kg, gmd: Math.round(kg * rate) };
  });

  const request = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const ref = await requestPayout();
      toast.success(`Payout ${ref} requested`, {
        description: "An admin will send it and you'll be notified when it's paid.",
      });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const disabledReason = waiting.length
    ? "A payout request is already waiting"
    : unpaid.length === 0
      ? "Nothing unpaid yet"
      : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Collector"
        title="Earnings"
        description={`You earn GMD ${rate} for every kilogram you record. Request a payout any time you have unpaid collections.`}
        actions={
          <Button
            onClick={request}
            disabled={busy || !!disabledReason}
            title={disabledReason ?? undefined}
          >
            {busy ? <Loader2 className="animate-spin" /> : <Banknote />}{" "}
            {disabledReason ?? `Request ${fmtGmd(unpaidGmd)}`}
          </Button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Unpaid balance"
          value={fmtGmd(unpaidGmd)}
          sub={`${fmtKg(unpaidKg)} · ${unpaid.length} collections`}
          icon={Wallet}
          tone="brand"
        />
        <StatCard
          label="Waiting to be paid"
          value={fmtGmd(waiting.reduce((s, o) => s + o.amountGmd, 0))}
          sub={waiting.length ? waiting.map((o) => o.id).join(", ") : "No open requests"}
          icon={Clock}
        />
        <StatCard
          label="Paid out"
          value={fmtGmd(paid.reduce((s, o) => s + o.amountGmd, 0))}
          sub={`${paid.length} ${paid.length === 1 ? "payout" : "payouts"} · ${fmtKg(done.reduce((s, p) => s + (p.weightKg ?? 0), 0))} collected`}
          icon={Scale}
        />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Payouts">
          {state.payouts.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No payouts yet. Request one when you have unpaid collections.
            </p>
          )}
          <ul className="divide-y">
            {state.payouts.map((o) => (
              <li
                key={o.uuid}
                className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
              >
                <span>
                  <b className="font-mono">{o.id}</b> · {fmtKg(o.quantity)} at GMD {o.rate ?? rate}
                  /kg
                  <br />
                  <span className="text-xs text-muted-foreground">
                    Requested {fmtShortDate(o.createdAt.slice(0, 10))}
                    {o.paidAt &&
                      ` · paid ${fmtShortDate(o.paidAt.slice(0, 10))} by ${o.method?.toLowerCase()}${o.reference ? ` (ref ${o.reference})` : ""}`}
                    {o.status === "cancelled" && o.note && ` · ${o.note}`}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <Badge variant={PAYOUT_BADGE[o.status].variant}>
                    {PAYOUT_BADGE[o.status].label}
                  </Badge>
                  <b className="tabular">{fmtGmd(o.amountGmd)}</b>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Weekly earnings (GMD)">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={weeks}>
                <XAxis dataKey="w" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Bar dataKey="gmd" fill="var(--primary)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
      <Panel title="Earnings by collection">
        {done.length === 0 && (
          <p className="text-sm text-muted-foreground">No weighed collections yet.</p>
        )}
        <ul className="divide-y">
          {done.map((p) => {
            const po = p.payoutId ? payoutById.get(p.payoutId) : undefined;
            const tag = p.unsynced
              ? { label: "Not synced", variant: "warning" as const }
              : po
                ? PAYOUT_BADGE[po.status]
                : { label: "Unpaid", variant: "muted" as const };
            return (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
              >
                <span>
                  {p.customer} · {fmtKg(p.weightKg ?? 0)}{" "}
                  <span className="text-muted-foreground">
                    {fmtShortDate(p.collectedAt ?? p.date)}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <Badge variant={tag.variant}>
                    {po && po.status !== "cancelled" ? `${po.id} · ${tag.label}` : tag.label}
                  </Badge>
                  <b className="tabular">{fmtGmd((p.weightKg ?? 0) * (po?.rate ?? rate))}</b>
                </span>
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}
