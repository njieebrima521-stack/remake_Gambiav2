import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Gift, Hourglass, Sparkles, Ticket } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { PointsCard } from "@/components/remake/PointsCard";
import { PageHeader, Panel, Simulated, StatCard } from "@/components/remake/ui";
import { useRemake } from "@/lib/remake/store";
import { canRedeem } from "@/lib/remake/logic";
import { fmtGmd, fmtNum, fmtShortDate } from "@/lib/remake/format";
import type { Reward } from "@/lib/remake/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/resident/rewards")({
  head: () => ({
    meta: [
      { title: "Green Coins & Rewards — Remake" },
      {
        name: "description",
        content: "Your Green Coins wallet, rewards catalogue and redemption history.",
      },
      { property: "og:title", content: "Green Coins & Rewards — Remake" },
      {
        property: "og:description",
        content: "Redeem Green Coins for airtime, cash power, food and household items.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RewardsPage,
});

const CATS = ["All", "Airtime & Data", "Household", "Food", "Education", "Services"] as const;
const TXN_STYLE = {
  earned: "text-primary",
  pending: "text-warning",
  redeemed: "text-foreground",
  forfeited: "text-destructive",
} as const;

function RewardsPage() {
  const { state, redeem } = useRemake();
  const [cat, setCat] = useState<(typeof CATS)[number]>("All");
  const [confirm, setConfirm] = useState<Reward | null>(null);
  const [voucher, setVoucher] = useState<{ name: string; code: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const list = state.rewards
    .filter((r) => r.active && (cat === "All" || r.category === cat))
    .sort((a, b) => a.cost - b.cost);
  const spent = state.transactions
    .filter((t) => t.type === "redeemed")
    .reduce((s, t) => s - t.amount, 0);

  const doRedeem = async () => {
    if (!confirm || busy) return;
    setBusy(true);
    const res = await redeem(confirm, requestId);
    setBusy(false);
    if (!res.ok) toast.error(res.error);
    else {
      setVoucher({ name: confirm.name, code: res.voucher });
      setRequestId(crypto.randomUUID());
    }
    setConfirm(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Resident"
        title="Green Coins & rewards"
        description="10 Green Coins ≈ GMD 1. Only available coins can be spent — pending coins unlock after a processor verifies your waste."
        actions={<Simulated label="Demo vouchers" />}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_1.6fr]">
        <PointsCard />
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Available"
            value={fmtNum(state.wallet.available)}
            sub="Ready to redeem"
            icon={Sparkles}
            tone="brand"
          />
          <StatCard
            label="Pending"
            value={fmtNum(state.wallet.pending)}
            sub="Awaiting verification"
            icon={Hourglass}
          />
          <StatCard
            label="Redeemed"
            value={fmtNum(spent)}
            sub={`${state.redemptions.length} rewards claimed`}
            icon={Ticket}
          />
        </div>
      </div>

      <Panel
        title="All rewards"
        description="Choose your reward"
        action={
          <div className="flex flex-wrap gap-1.5">
            {CATS.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold",
                  cat === c
                    ? "bg-ink text-ink-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/70",
                )}
              >
                {c}
              </button>
            ))}
          </div>
        }
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.length === 0 && (
            <p className="text-sm text-muted-foreground">No rewards in this category right now.</p>
          )}
          {list.map((r) => {
            const check = canRedeem(state.wallet.available, r.cost, r.stock, r.active);
            const can = check.ok;
            return (
              <div
                key={r.id}
                className="relative flex items-center justify-between gap-4 rounded-2xl bg-mint p-5"
              >
                <div className="min-w-0">
                  <p className="font-display text-lg font-bold leading-tight text-foreground">
                    {r.name}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {r.partner} · worth {fmtGmd(r.valueGmd)} ·{" "}
                    {r.stock > 0 ? `${r.stock} left` : "Out of stock"}
                  </p>
                  <p className="mt-2 font-display font-semibold text-primary-strong">
                    {fmtNum(r.cost)} coins
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-center gap-2">
                  <Gift className="size-9 text-gift" />
                  <Button
                    variant={can ? "pill" : "secondary"}
                    size="sm"
                    className="rounded-full"
                    onClick={() => (check.ok ? setConfirm(r) : toast.error(check.error))}
                  >
                    Claim now
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      <div id="history" className="grid scroll-mt-24 gap-6 xl:grid-cols-2">
        <Panel title="Redemption history">
          {state.redemptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No rewards redeemed yet.</p>
          ) : (
            <ul className="divide-y">
              {state.redemptions.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className="font-semibold">{r.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {r.voucher} · {fmtShortDate(r.date)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">-{fmtNum(r.cost)}</p>
                    <Badge variant={r.status === "Delivered" ? "success" : "info"}>
                      {r.status}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Wallet transactions">
          {state.transactions.length === 0 && (
            <p className="text-sm text-muted-foreground">No transactions yet.</p>
          )}
          <ul className="divide-y">
            {state.transactions.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{t.label}</p>
                  <p className="text-xs capitalize text-muted-foreground">
                    {fmtShortDate(t.date)} · {t.type}
                  </p>
                </div>
                <span className={cn("font-display font-semibold tabular", TXN_STYLE[t.type])}>
                  {t.amount > 0 ? "+" : ""}
                  {fmtNum(t.amount)}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogTitle>Redeem {confirm?.name}?</DialogTitle>
          <DialogDescription>
            {confirm &&
              `${fmtNum(confirm.cost)} Green Coins will be deducted. You'll have ${fmtNum(state.wallet.available - confirm.cost)} left.`}
          </DialogDescription>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button onClick={doRedeem} disabled={busy}>
              Confirm redemption
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!voucher} onOpenChange={(o) => !o && setVoucher(null)}>
        <DialogContent className="text-center">
          <Gift className="mx-auto size-14 text-gift" />
          <DialogTitle className="font-display text-2xl">Reward claimed</DialogTitle>
          <DialogDescription>{voucher?.name}</DialogDescription>
          <p className="mx-auto rounded-xl border border-dashed px-5 py-3 font-mono text-lg font-bold tracking-widest">
            {voucher?.code}
          </p>
          <p className="text-xs text-muted-foreground">
            Show this code at the partner. Vouchers are not yet connected to partner systems.
          </p>
          <Button onClick={() => setVoucher(null)}>Done</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
