import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/remake/logic";
import { ChevronRight, Factory, PackageCheck, Scale, Truck } from "lucide-react";
import {
  BatchStatusBadge,
  DecisionBadge,
  EmptyState,
  PageHeader,
  Panel,
  StatCard,
} from "@/components/remake/ui";
import { useRemake } from "@/lib/remake/store";
import { MATERIALS } from "@/lib/remake/data";
import { fmtKg, fmtShortDate } from "@/lib/remake/format";
import { materialTypeName } from "@/lib/remake/material-types";
import {
  listInstitutions,
  type ApprovalStatus,
  type Institution,
} from "@/lib/remake/services/institutions";

export const Route = createFileRoute("/_authenticated/processor/")({
  head: () => ({
    meta: [
      { title: "Processor Dashboard — Remake" },
      {
        name: "description",
        content: "Incoming recycling batches awaiting inspection and verification.",
      },
      { property: "og:title", content: "Processor Dashboard — Remake" },
      { property: "og:description", content: "Verify incoming Remake batches." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProcessorPage,
});

const SPEC_VARIANT: Record<ApprovalStatus, "success" | "warning" | "danger" | "muted"> = {
  approved: "success",
  pending: "warning",
  rejected: "danger",
  suspended: "muted",
};

function ProcessorPage() {
  const { state, lookupBatchCode } = useRemake();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [myInst, setMyInst] = useState<Institution | null>(null);

  const myProcessorOrg = state.me?.orgs.find((o) => o.kind === "processor");
  const orgName = myProcessorOrg?.name ?? "Processor";

  useEffect(() => {
    listInstitutions()
      .then((list) => {
        const match = myProcessorOrg
          ? list.find((i) => i.id === myProcessorOrg.id)
          : list.find((i) => i.kind === "processor");
        setMyInst(match ?? null);
      })
      .catch(() => setMyInst(null));
  }, [myProcessorOrg]);

  const findBatch = async () => {
    try {
      const ref = await lookupBatchCode(code);
      navigate({ to: "/processor/batches/$id", params: { id: ref } });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  const incoming = state.batches.filter((b) => b.status === "in_transit");
  const upcoming = state.batches.filter((b) => b.status === "ready");
  const done = state.batches.filter((b) => b.status === "verified");
  const acc = done.reduce((s, b) => s + (b.acceptedKg ?? 0), 0);
  const tot = done.reduce((s, b) => s + (b.acceptedKg ?? 0) + (b.rejectedKg ?? 0), 0);
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={orgName}
        title="Incoming batches"
        description="Inspect each batch, weigh it on arrival and record your decision. Residents' pending coins are released when you verify."
        actions={
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && findBatch()}
              placeholder="Batch QR or BT-…"
              aria-label="Batch code"
              className="h-10 w-48 rounded-xl border bg-card px-3 font-mono text-sm uppercase outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <Button variant="outline" onClick={findBatch} disabled={!code.trim()}>
              Open
            </Button>
          </div>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Awaiting inspection" value={incoming.length} icon={Truck} tone="brand" />
        <StatCard label="At hub, not shipped" value={upcoming.length} icon={Factory} />
        <StatCard label="Verified batches" value={done.length} icon={PackageCheck} />
        <StatCard
          label="Acceptance rate"
          value={tot ? `${Math.round((acc / tot) * 100)}%` : "—"}
          sub={`${fmtKg(acc)} accepted`}
          icon={Scale}
        />
      </div>

      {myInst && myInst.specialisations.length > 0 && (
        <Panel title="Material specialisations">
          <div className="flex flex-wrap gap-2">
            {myInst.specialisations.map((s) => (
              <Badge key={s.materialType} variant={SPEC_VARIANT[s.status]} className="capitalize">
                {materialTypeName(s.materialType)} · {s.status}
              </Badge>
            ))}
          </div>
        </Panel>
      )}

      <Panel title="Ready for inspection">
        {incoming.length === 0 ? (
          <EmptyState icon={Truck} title="No batches in transit">
            Batches appear when the hub hands them over.
          </EmptyState>
        ) : (
          <ul className="divide-y">
            {incoming.map((b) => (
              <li key={b.id}>
                <Link
                  to="/processor/batches/$id"
                  params={{ id: b.id }}
                  className="flex items-center gap-4 py-3 hover:bg-muted/40"
                >
                  <img
                    src={MATERIALS[b.material].image}
                    alt=""
                    className="size-12 rounded-xl object-cover"
                  />
                  <div className="flex-1">
                    <p className="font-semibold">
                      {b.id} · {MATERIALS[b.material].name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Declared {fmtKg(b.totalKg)} · {b.itemCount} loads ·{" "}
                      {fmtShortDate(b.createdAt)}
                    </p>
                  </div>
                  <BatchStatusBadge status={b.status} />
                  <ChevronRight className="size-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel
        title="Recent decisions"
        action={
          <Link
            to="/processor/history"
            className="text-sm font-semibold text-primary hover:underline"
          >
            History
          </Link>
        }
      >
        {done.length === 0 && (
          <p className="text-sm text-muted-foreground">No verified batches yet.</p>
        )}
        <ul className="divide-y">
          {done.slice(0, 4).map((b) => (
            <li key={b.id} className="flex items-center justify-between py-3 text-sm">
              <span>
                <b>{b.id}</b> · {MATERIALS[b.material].name} · {fmtKg(b.acceptedKg ?? 0)} of{" "}
                {fmtKg(b.totalKg)}
              </span>
              <DecisionBadge decision={b.decision} />
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
