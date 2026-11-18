import type { ReactNode } from "react";
import { QRCodeSVG } from "qrcode.react";
import { FlaskConical, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { BatchDecision, BatchStatus, Pickup, PickupStatus } from "@/lib/remake/types";
import { MATERIALS } from "@/lib/remake/data";
import { fmtDate, fmtKg, fmtNum } from "@/lib/remake/format";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow && (
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-semibold md:text-[28px]">{title}</h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground md:text-[15px]">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Simulated({
  label = "Simulated",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-dashed border-primary/40 bg-mint/60 px-2 py-0.5 text-[11px] font-medium text-mint-foreground",
        className,
      )}
    >
      <FlaskConical className="size-3" /> {label}
    </span>
  );
}

export function Panel({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("min-w-0 rounded-2xl border bg-card shadow-card", className)}>
      {(title || action) && (
        <header className="flex flex-col items-start gap-3 px-4 pt-5 sm:flex-row sm:justify-between sm:gap-4 sm:px-6">
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={cn("p-4 sm:p-6", title && "pt-4 sm:pt-4", bodyClassName)}>{children}</div>
    </section>
  );
}

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon: LucideIcon;
  tone?: "default" | "brand" | "ink";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-5 shadow-card",
        tone === "default" && "bg-card",
        tone === "brand" && "border-transparent bg-gradient-brand text-primary-foreground",
        tone === "ink" && "border-transparent bg-gradient-ink text-ink-foreground",
      )}
    >
      <div className="flex items-center justify-between">
        <p
          className={cn(
            "text-sm font-medium",
            tone === "default" ? "text-muted-foreground" : "opacity-85",
          )}
        >
          {label}
        </p>
        <span
          className={cn(
            "grid size-9 place-items-center rounded-xl",
            tone === "default" ? "bg-mint text-mint-foreground" : "bg-ink-foreground/15",
          )}
        >
          <Icon className="size-[18px]" />
        </span>
      </div>
      <p className="mt-3 font-display text-[26px] font-semibold tabular leading-none">{value}</p>
      {sub && (
        <p
          className={cn(
            "mt-2 text-xs",
            tone === "default" ? "text-muted-foreground" : "opacity-80",
          )}
        >
          {sub}
        </p>
      )}
    </div>
  );
}

const PICKUP_STATUS: Record<
  PickupStatus,
  { label: string; variant: "info" | "warning" | "success" | "muted" | "ink" | "danger" }
> = {
  scheduled: { label: "Scheduled", variant: "info" },
  collected: { label: "Collected · at hub", variant: "warning" },
  batched: { label: "Batched", variant: "ink" },
  verified: { label: "Verified", variant: "success" },
  rejected: { label: "Rejected at pickup", variant: "danger" },
};

export function PickupStatusBadge({ status }: { status: PickupStatus }) {
  const s = PICKUP_STATUS[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

const BATCH_STATUS: Record<
  BatchStatus,
  { label: string; variant: "info" | "warning" | "success" }
> = {
  ready: { label: "Ready for handover", variant: "warning" },
  in_transit: { label: "Handed over", variant: "info" },
  verified: { label: "Verified", variant: "success" },
};

export function BatchStatusBadge({ status }: { status: BatchStatus }) {
  const s = BATCH_STATUS[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

export function QrBlock({
  value,
  size = 148,
  caption,
}: {
  value: string;
  size?: number;
  caption?: string;
}) {
  return (
    <div className="inline-flex flex-col items-center gap-2 rounded-2xl border bg-card p-4">
      <QRCodeSVG
        value={value}
        size={size}
        fgColor="currentColor"
        bgColor="transparent"
        className="text-ink"
        level="M"
      />
      <p className="font-mono text-xs font-semibold tracking-wider">{value}</p>
      {caption && <p className="text-[11px] text-muted-foreground">{caption}</p>}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/40 px-6 py-10 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-mint text-mint-foreground">
        <Icon className="size-6" />
      </span>
      <p className="mt-3 font-semibold">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

export function MaterialDot({ className }: { className?: string }) {
  return <span className={cn("inline-block size-2 rounded-full bg-primary", className)} />;
}

const DECISION: Record<
  BatchDecision,
  { label: string; variant: "success" | "warning" | "danger" }
> = {
  accepted: { label: "Accepted", variant: "success" },
  partial: { label: "Partially accepted", variant: "warning" },
  rejected: { label: "Rejected", variant: "danger" },
};

export function DecisionBadge({ decision }: { decision?: BatchDecision | undefined }) {
  if (!decision) return null;
  const d = DECISION[decision];
  return <Badge variant={d.variant}>{d.label}</Badge>;
}

/** Printable-style collection receipt shared by resident and collector views. */
export function ReceiptCard({ pickup }: { pickup: Pickup }) {
  if (!pickup.receiptNo) return null;
  const m = MATERIALS[pickup.material];
  const rows: [string, ReactNode][] = [
    ["Receipt no.", <span className="font-mono">{pickup.receiptNo}</span>],
    ["Pickup", <span className="font-mono">{pickup.id}</span>],
    ["Customer", pickup.customer],
    ["Address", `${pickup.address}, ${pickup.area}`],
    ["Material", m.name],
    ["Bags", pickup.bags],
    ["Recorded weight", fmtKg(pickup.weightKg ?? 0)],
    ["Collected", pickup.collectedAt ? fmtDate(pickup.collectedAt) : "—"],
    ["Collector", pickup.collector],
  ];
  if (pickup.mine && pickup.status !== "rejected")
    rows.push([
      "Green Coins",
      pickup.status === "verified"
        ? `${fmtNum(pickup.pointsAwarded ?? 0)} available`
        : `${fmtNum(pickup.pointsPending ?? 0)} pending`,
    ]);
  return (
    <div className="rounded-2xl border border-dashed bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-display text-lg font-semibold">Collection receipt</p>
        {pickup.unsynced && (
          <span className="text-xs font-semibold text-warning">Not synced yet</span>
        )}
      </div>
      <dl className="divide-y text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 py-2">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="text-right font-medium">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
