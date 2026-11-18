import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CloudOff } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader, Panel, PickupStatusBadge, ReceiptCard } from "@/components/remake/ui";
import { useRemake } from "@/lib/remake/store";
import { MATERIALS } from "@/lib/remake/data";
import { fmtKg, fmtShortDate } from "@/lib/remake/format";
import type { Pickup } from "@/lib/remake/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/collector/receipts")({
  head: () => ({
    meta: [
      { title: "Collection Records — Remake Collector" },
      { name: "description", content: "Accepted and rejected collection records with receipts." },
      { property: "og:title", content: "Collection Records — Remake Collector" },
      { property: "og:description", content: "Accepted and rejected Remake collections." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReceiptsPage,
});

function ReceiptsPage() {
  const { state } = useRemake();
  const [tab, setTab] = useState<"accepted" | "rejected">("accepted");
  const [open, setOpen] = useState<Pickup | null>(null);
  const mine = state.pickups.filter((p) => p.assignedToMe && p.status !== "scheduled");
  const rows = mine.filter((p) =>
    tab === "rejected" ? p.status === "rejected" : p.status !== "rejected",
  );
  return (
    <div>
      <PageHeader
        eyebrow="Collector"
        title="Records & receipts"
        description="Every handover you've recorded, including rejections."
      />
      <Panel
        action={
          <div className="flex flex-wrap gap-1.5">
            {(["accepted", "rejected"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold capitalize",
                  tab === k ? "bg-ink text-ink-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                {k} (
                {
                  mine.filter((p) =>
                    k === "rejected" ? p.status === "rejected" : p.status !== "rejected",
                  ).length
                }
                )
              </button>
            ))}
          </div>
        }
        title={tab === "accepted" ? "Accepted collections" : "Rejected pickups"}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tab === "accepted" ? "Receipt" : "Pickup"}</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Material</TableHead>
              <TableHead>{tab === "accepted" ? "Weight" : "Reason"}</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((p) => (
              <TableRow
                key={p.id}
                className="cursor-pointer"
                onClick={() => tab === "accepted" && setOpen(p)}
              >
                <TableCell className="font-mono text-xs">
                  {p.receiptNo ?? p.id}{" "}
                  {p.unsynced && <CloudOff className="inline size-3.5 text-warning" />}
                </TableCell>
                <TableCell>{p.customer}</TableCell>
                <TableCell>{MATERIALS[p.material].name}</TableCell>
                <TableCell>
                  {tab === "accepted" ? fmtKg(p.weightKg ?? 0) : p.rejectReason}
                </TableCell>
                <TableCell>{fmtShortDate(p.collectedAt ?? p.date)}</TableCell>
                <TableCell>
                  <PickupStatusBadge status={p.status} />
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  No records yet.{" "}
                  <Link to="/collector/today" className="font-semibold text-primary">
                    Open route
                  </Link>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Panel>
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent>
          <DialogTitle className="sr-only">Receipt</DialogTitle>
          {open && <ReceiptCard pickup={open} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
