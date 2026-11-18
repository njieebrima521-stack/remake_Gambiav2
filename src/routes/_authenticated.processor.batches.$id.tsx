import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, ClipboardCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  BatchStatusBadge,
  DecisionBadge,
  PageHeader,
  Panel,
  QrBlock,
} from "@/components/remake/ui";
import { useRemake } from "@/lib/remake/store";
import { MATERIALS } from "@/lib/remake/data";
import { decisionFor, errorMessage } from "@/lib/remake/logic";
import { fmtKg } from "@/lib/remake/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/processor/batches/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Inspect ${params.id} — Remake Processor` },
      {
        name: "description",
        content: "Compare declared and actual weight and record an acceptance decision.",
      },
      { property: "og:title", content: `Inspect ${params.id} — Remake Processor` },
      { property: "og:description", content: "Batch inspection and verification." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InspectPage,
});

const GRADES = ["Grade A", "Grade B", "Grade C"];
const inputCls =
  "mt-1.5 h-11 w-full rounded-xl border bg-card px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

function InspectPage() {
  const { id } = Route.useParams();
  const { state, verifyBatch } = useRemake();
  const b = state.batches.find((x) => x.id === id);
  const [actualInput, setActual] = useState<string | null>(null);
  const [rejected, setRejected] = useState("0");
  const [grade, setGrade] = useState<string>(GRADES[0]!);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  if (!b)
    return (
      <div className="rounded-2xl border border-dashed p-10 text-center">
        Batch not found.{" "}
        <Link to="/processor" className="font-semibold text-primary">
          Back
        </Link>
      </div>
    );
  const actual = actualInput ?? String(b.totalKg);
  const a = Number(actual) || 0;
  const r = Math.min(Number(rejected) || 0, a);
  const acceptedKg = Math.max(0, a - r);
  const diff = a - b.totalKg;
  const decision = decisionFor(acceptedKg, r);
  const submit = async () => {
    if (!(a > 0)) {
      toast.error("Enter the actual weight");
      return;
    }
    if (Number(rejected) > a) {
      toast.error("Rejected weight can't be more than the actual weight");
      return;
    }
    if (decision === "rejected" && !note.trim()) {
      toast.error("Add a note explaining the rejection");
      return;
    }
    setBusy(true);
    try {
      await verifyBatch(b.id, a, r, grade, note.trim() || undefined);
      toast.success(`Batch ${b.id} ${decision === "partial" ? "partially accepted" : decision}`, {
        description: "Residents' pending coins have been settled.",
      });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
        <Link to="/processor">
          <ArrowLeft /> Incoming
        </Link>
      </Button>
      <PageHeader
        eyebrow={`Batch ${b.id}`}
        title={`Inspect ${MATERIALS[b.material].name}`}
        description={`From Kanifing Recycling Hub · ${b.itemCount} load${b.itemCount === 1 ? "" : "s"}`}
        actions={
          <>
            <BatchStatusBadge status={b.status} />
            <DecisionBadge decision={b.decision} />
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-6">
          <Panel title="Manifest">
            <div className="flex justify-center">
              <QrBlock value={b.code} caption="Batch manifest code" />
            </div>
          </Panel>
          <Panel title="Declared vs actual">
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-2xl bg-muted p-4">
                <p className="text-xs text-muted-foreground">Declared by hub</p>
                <p className="font-display text-2xl font-semibold">{fmtKg(b.totalKg)}</p>
              </div>
              <div className="rounded-2xl bg-ink p-4 text-ink-foreground">
                <p className="text-xs text-ink-muted">Actual on scale</p>
                <p className="font-display text-2xl font-semibold">
                  {b.status === "verified"
                    ? fmtKg((b.acceptedKg ?? 0) + (b.rejectedKg ?? 0))
                    : fmtKg(a)}
                </p>
              </div>
            </div>
            {b.status !== "verified" && (
              <p
                className={cn(
                  "mt-3 text-center text-sm font-semibold",
                  Math.abs(diff) > b.totalKg * 0.05 ? "text-warning" : "text-primary",
                )}
              >
                Difference {diff >= 0 ? "+" : ""}
                {fmtKg(diff)}
              </p>
            )}
          </Panel>
        </div>
        {b.status === "in_transit" ? (
          <Panel title="Inspection & decision">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm font-medium">
                Actual weight (kg)
                <input
                  className={inputCls}
                  inputMode="decimal"
                  value={actual}
                  onChange={(e) => setActual(e.target.value.replace(/[^0-9.]/g, ""))}
                />
              </label>
              <label className="text-sm font-medium">
                Rejected / contaminated (kg)
                <input
                  className={inputCls}
                  inputMode="decimal"
                  value={rejected}
                  onChange={(e) => setRejected(e.target.value.replace(/[^0-9.]/g, ""))}
                />
              </label>
              <label className="text-sm font-medium">
                Quality grade
                <select
                  className={inputCls}
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                >
                  {GRADES.map((g) => (
                    <option key={g}>{g}</option>
                  ))}
                </select>
              </label>
              <div className="flex gap-2 md:items-end">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setRejected("0")}
                >
                  All good
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setRejected(actual)}
                >
                  Reject all
                </Button>
              </div>
              <label className="text-sm font-medium md:col-span-2">
                Inspection note
                <textarea
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. 2 kg food-soiled sachets removed"
                  className="mt-1.5 w-full rounded-xl border bg-card p-3 text-sm outline-none focus:border-primary"
                />
              </label>
            </div>
            <div className="mt-5 flex items-center justify-between rounded-2xl bg-mint p-4 text-mint-foreground">
              <span className="text-sm">
                Accepted <b>{fmtKg(acceptedKg)}</b> · Rejected <b>{fmtKg(r)}</b>
              </span>
              <DecisionBadge decision={decision} />
            </div>
            <Button size="lg" className="mt-5 w-full" onClick={submit} disabled={busy}>
              <ClipboardCheck /> Confirm verification
            </Button>
          </Panel>
        ) : b.status === "verified" ? (
          <Panel title="Verification result">
            <dl className="divide-y text-sm">
              {[
                ["Accepted", fmtKg(b.acceptedKg ?? 0)],
                ["Rejected", fmtKg(b.rejectedKg ?? 0)],
                ["Grade", b.grade ?? "—"],
                ["Note", b.inspectionNote ?? "—"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between py-2.5">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        ) : (
          <Panel title="Not yet shipped">
            <p className="text-sm text-muted-foreground">
              The hub must hand this batch over before it can be inspected.
            </p>
          </Panel>
        )}
      </div>
    </div>
  );
}
