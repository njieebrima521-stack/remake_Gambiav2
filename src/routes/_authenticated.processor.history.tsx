import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DecisionBadge, PageHeader, Panel } from "@/components/remake/ui";
import { useRemake } from "@/lib/remake/store";
import { MATERIALS } from "@/lib/remake/data";
import { fmtKg, fmtShortDate } from "@/lib/remake/format";
import type { BatchDecision } from "@/lib/remake/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/processor/history")({
  head: () => ({
    meta: [
      { title: "Processing History — Remake" },
      {
        name: "description",
        content: "All verified batches with accepted, partial and rejected decisions.",
      },
      { property: "og:title", content: "Processing History — Remake" },
      { property: "og:description", content: "Processor verification history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const { state } = useRemake();
  const [f, setF] = useState<"all" | BatchDecision>("all");
  const rows = state.batches.filter(
    (b) => b.status === "verified" && (f === "all" || b.decision === f),
  );
  return (
    <div>
      <PageHeader eyebrow="Processor" title="Processing history" />
      <Panel
        action={
          <div className="flex flex-wrap gap-1.5">
            {(["all", "accepted", "partial", "rejected"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setF(k)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold capitalize",
                  f === k ? "bg-ink text-ink-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                {k}
              </button>
            ))}
          </div>
        }
        title="Verified batches"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Batch</TableHead>
              <TableHead>Material</TableHead>
              <TableHead>Declared</TableHead>
              <TableHead>Accepted</TableHead>
              <TableHead>Rejected</TableHead>
              <TableHead>Grade</TableHead>
              <TableHead>Decision</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((b) => (
              <TableRow key={b.id}>
                <TableCell>
                  <Link
                    to="/processor/batches/$id"
                    params={{ id: b.id }}
                    className="font-mono font-semibold text-primary"
                  >
                    {b.id}
                  </Link>
                  <p className="text-xs text-muted-foreground">{fmtShortDate(b.createdAt)}</p>
                </TableCell>
                <TableCell>{MATERIALS[b.material].name}</TableCell>
                <TableCell>{fmtKg(b.totalKg)}</TableCell>
                <TableCell>{fmtKg(b.acceptedKg ?? 0)}</TableCell>
                <TableCell>{fmtKg(b.rejectedKg ?? 0)}</TableCell>
                <TableCell>{b.grade}</TableCell>
                <TableCell>
                  <DecisionBadge decision={b.decision} />
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  No batches match.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Panel>
    </div>
  );
}
