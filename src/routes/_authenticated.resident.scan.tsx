import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { History, ScanLine, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader, Panel } from "@/components/remake/ui";
import { WasteScanner } from "@/components/remake/WasteScanner";
import {
  materialTypeById,
  materialTypeName,
  type MaterialTypeId,
} from "@/lib/remake/material-types";
import { listScanHistory, type ScanRecord } from "@/lib/remake/services/scans";
import { fmtShortDate } from "@/lib/remake/format";

export const Route = createFileRoute("/_authenticated/resident/scan")({
  head: () => ({
    meta: [
      { title: "Waste Scanner — Remake" },
      {
        name: "description",
        content: "Photograph your waste to identify recyclable material categories before booking.",
      },
      { property: "og:title", content: "Waste Scanner — Remake" },
      {
        property: "og:description",
        content: "Identify recyclables from a real photo and book separated streams.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ScanPage,
});

function ScanPage() {
  const navigate = useNavigate();
  const [history, setHistory] = useState<ScanRecord[]>([]);
  const [historyState, setHistoryState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [selectedHistory, setSelectedHistory] = useState<ScanRecord | null>(null);

  const loadHistory = () => {
    listScanHistory(10)
      .then((rows) => {
        setHistory(rows);
        setHistoryState("ready");
      })
      .catch(() => {
        setHistoryState("unavailable");
      });
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const goToBooking = (categories: MaterialTypeId[], scanId?: string) => {
    const first = categories[0];
    const parent = first ? materialTypeById(first)?.parent : undefined;
    navigate({
      to: "/resident/pickups",
      search: {
        tab: "book",
        material: parent,
        types: categories.length ? categories.join(",") : undefined,
        scanId,
      },
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Resident"
        title="Waste scanner"
        description="Take or upload a real photo to identify materials, confirm categories, and start a separated pickup booking."
      />

      <Panel
        title="Photo analysis"
        description="AI detection is indicative only and never sets final weights or Green Coins."
      >
        <WasteScanner
          initialScan={selectedHistory}
          confirmLabel="Use confirmed categories for booking"
          onConfirmed={({ scanId, categories }) => {
            loadHistory();
            goToBooking(categories, scanId);
          }}
        />
      </Panel>

      <Panel
        title="Recent scan history"
        description="Previously saved scans from your account."
        action={<History className="size-4 text-muted-foreground" />}
      >
        {historyState === "loading" ? (
          <p className="text-sm text-muted-foreground">Loading scan history…</p>
        ) : historyState === "unavailable" ? (
          <p className="text-sm text-muted-foreground">Scan history is not available right now.</p>
        ) : history.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            <ScanLine className="size-5 shrink-0 text-primary" />
            <span>No saved scans yet.</span>
          </div>
        ) : (
          <ul className="divide-y">
            {history.map((s) => {
              const cats = Array.from(
                new Set(
                  s.detections
                    .filter((d) => d.status !== "removed")
                    .map((d) => d.correctedCategory ?? d.category)
                    .filter((c): c is MaterialTypeId => c !== "other"),
                ),
              );
              return (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {cats.length
                        ? cats.map((c) => materialTypeName(c)).join(", ")
                        : "Unclassified scan"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {fmtShortDate(s.createdAt.slice(0, 10))} ·{" "}
                      {s.confirmed ? "Confirmed" : "Unconfirmed"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {s.mixed && <Badge variant="warning">Mixed</Badge>}
                    <button
                      type="button"
                      onClick={() => setSelectedHistory(s)}
                      className="rounded-lg border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
                    >
                      Inspect
                    </button>
                    {cats.length > 0 && (
                      <button
                        type="button"
                        onClick={() => goToBooking(cats, s.id)}
                        className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground"
                      >
                        <Truck className="size-3.5" /> Book
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
