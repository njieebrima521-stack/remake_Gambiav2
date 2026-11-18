import { Link } from "@tanstack/react-router";
import { Gift, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRemake } from "@/lib/remake/store";
import { fmtNum, fmtGmd } from "@/lib/remake/format";

export function PointsCard() {
  const { state } = useRemake();
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-ink p-6 text-ink-foreground shadow-lift">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <span className="grid size-14 place-items-center rounded-full border border-ink-foreground/30">
            <RotateCw className="size-6" />
          </span>
          <div>
            <p className="text-sm text-ink-muted">Green Coins</p>
            <p className="font-display text-4xl font-semibold tabular leading-tight">
              {fmtNum(state.wallet.available)}
            </p>
          </div>
        </div>
        <Gift className="size-14 text-primary" strokeWidth={1.6} />
      </div>
      <div className="mt-5 flex items-center justify-between text-sm">
        <span className="text-ink-muted">
          ≈ {fmtGmd(state.wallet.available / (state.settings.coinsPerGmd || 10))} value
        </span>
        <span className="rounded-full bg-ink-foreground/10 px-2.5 py-0.5 text-xs">
          +{fmtNum(state.wallet.pending)} pending
        </span>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <Button asChild variant="pill" size="lg" className="rounded-full">
          <Link to="/resident/rewards">Redeem coins</Link>
        </Button>
        <Button asChild variant="ink-outline" size="lg" className="rounded-full">
          <Link to="/resident/rewards" hash="history">
            History
          </Link>
        </Button>
      </div>
    </div>
  );
}
