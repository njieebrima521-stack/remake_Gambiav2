import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Banknote, Clock, Download, HandCoins, Loader2, Store, Truck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Panel, StatCard } from "@/components/remake/ui";
import { supabase } from "@/integrations/supabase/client";
import { useRemake } from "@/lib/remake/store";
import { fmtGmd, fmtKg, fmtNum } from "@/lib/remake/format";
import { errorMessage, payoutPaymentError } from "@/lib/remake/logic";
import type { PayoutStatus } from "@/lib/remake/types";
import { cn } from "@/lib/utils";

interface PayoutRow {
  id: string;
  ref: string;
  kind: "collector" | "partner";
  payee_name: string;
  item_count: number;
  quantity: number;
  rate: number | null;
  amount_gmd: number;
  status: PayoutStatus;
  method: string | null;
  reference: string | null;
  note: string | null;
  created_at: string;
  paid_at: string | null;
  cancelled_at: string | null;
}
interface Balance {
  kind: "collector" | "partner";
  payee_user_id: string | null;
  payee_name: string;
  item_count: number;
  quantity: number;
  amount_gmd: number;
}

async function loadPayouts() {
  const [payouts, balances] = await Promise.all([
    supabase.from("payouts").select("*").order("created_at", { ascending: false }).limit(500),
    supabase.rpc("admin_payout_balances"),
  ]);
  if (payouts.error) throw new Error(payouts.error.message);
  if (balances.error) throw new Error(balances.error.message);
  const num = (r: Record<string, unknown>, k: string) => Number(r[k] ?? 0);
  return {
    payouts: (payouts.data ?? []).map((r) => ({
      ...r,
      quantity: Number(r.quantity),
      amount_gmd: Number(r.amount_gmd),
      rate: r.rate === null ? null : Number(r.rate),
    })) as PayoutRow[],
    balances: ((balances.data ?? []) as unknown as Record<string, unknown>[]).map((b) => ({
      ...b,
      item_count: num(b, "item_count"),
      quantity: num(b, "quantity"),
      amount_gmd: num(b, "amount_gmd"),
    })) as unknown as Balance[],
  };
}

const STATUS: Record<PayoutStatus, { label: string; variant: "warning" | "success" | "muted" }> = {
  pending: { label: "Pending", variant: "warning" },
  paid: { label: "Paid", variant: "success" },
  cancelled: { label: "Cancelled", variant: "muted" },
};
const METHODS = ["Mobile money", "Bank transfer", "Cash"] as const;
const chip = (on: boolean) =>
  cn(
    "rounded-full px-3 py-1 text-xs font-semibold",
    on ? "bg-ink text-ink-foreground" : "bg-muted text-muted-foreground",
  );
const fieldCls =
  "h-10 w-full rounded-lg border bg-card px-3 text-sm outline-none focus:border-primary";
const qty = (p: { kind: string; quantity: number }) =>
  p.kind === "collector" ? fmtKg(p.quantity) : `${fmtNum(p.quantity)} vouchers`;

export function AdminPayouts() {
  const { state } = useRemake();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["remake-admin-payouts"],
    queryFn: loadPayouts,
    refetchInterval: 30_000,
  });
  const [kindF, setKindF] = useState<"all" | "collector" | "partner">("all");
  const [statusF, setStatusF] = useState<"all" | PayoutStatus>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ mode: "pay" | "cancel"; payout: PayoutRow } | null>(null);
  const [method, setMethod] = useState<string>("Mobile money");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");

  const act = async (
    key: string,
    fn: () => PromiseLike<{ data: unknown; error: { message: string } | null }>,
    ok: (data: unknown) => string,
  ) => {
    setBusy(key);
    try {
      const { data, error } = await fn();
      if (error) throw new Error(error.message);
      toast.success(ok(data));
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["remake-admin-payouts"] }),
        qc.invalidateQueries({ queryKey: ["remake-admin"] }),
      ]);
      return true;
    } catch (e) {
      toast.error(errorMessage(e));
      return false;
    } finally {
      setBusy(null);
    }
  };

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Loading payouts…</p>;
  if (q.error) return <p className="text-sm text-destructive">{errorMessage(q.error)}</p>;
  const { payouts, balances } = q.data!;
  const owedCollectors = balances.filter((b) => b.kind === "collector");
  const owedPartners = balances.filter((b) => b.kind === "partner");
  const pending = payouts.filter((p) => p.status === "pending");
  const monthKey = format(new Date(), "yyyy-MM");
  const paidMonth = payouts.filter(
    (p) => p.status === "paid" && (p.paid_at ?? "").startsWith(monthKey),
  );
  const list = payouts.filter(
    (p) => (kindF === "all" || p.kind === kindF) && (statusF === "all" || p.status === statusF),
  );
  const ref = (data: unknown) => (data as { ref?: string } | null)?.ref ?? "Payout";

  const openDialog = (mode: "pay" | "cancel", payout: PayoutRow) => {
    setMethod("Mobile money");
    setReference("");
    setNote("");
    setDialog({ mode, payout });
  };
  const confirm = async () => {
    if (!dialog) return;
    const { payout, mode } = dialog;
    if (mode === "pay") {
      const err = payoutPaymentError(method, reference);
      if (err) {
        toast.error(err);
        return;
      }
      const ok = await act(
        `pay-${payout.id}`,
        () =>
          supabase.rpc("admin_mark_payout_paid", {
            _payout: payout.id,
            _method: method,
            _reference: reference,
            _note: note,
          }),
        () => `${payout.ref} marked paid`,
      );
      if (ok) setDialog(null);
    } else {
      const ok = await act(
        `cancel-${payout.id}`,
        () => supabase.rpc("admin_cancel_payout", { _payout: payout.id, _note: note }),
        () => `${payout.ref} cancelled`,
      );
      if (ok) setDialog(null);
    }
  };

  const exportCsv = () => {
    const rows = [
      [
        "ref",
        "created",
        "type",
        "payee",
        "items",
        "quantity",
        "rate_gmd_per_kg",
        "amount_gmd",
        "status",
        "method",
        "reference",
        "paid_at",
        "note",
      ],
      ...list.map((p) => [
        p.ref,
        p.created_at,
        p.kind,
        p.payee_name,
        String(p.item_count),
        String(p.quantity),
        p.rate === null ? "" : String(p.rate),
        String(p.amount_gmd),
        p.status,
        p.method ?? "",
        p.reference ?? "",
        p.paid_at ?? "",
        p.note ?? "",
      ]),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `remake-payouts-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Owed, not yet in a payout"
          value={fmtGmd(balances.reduce((s, b) => s + b.amount_gmd, 0))}
          sub={`${owedCollectors.length} collectors · ${owedPartners.length} partners`}
          icon={HandCoins}
          tone="brand"
        />
        <StatCard
          label="Pending payouts"
          value={fmtGmd(pending.reduce((s, p) => s + p.amount_gmd, 0))}
          sub={`${pending.length} waiting to be sent`}
          icon={Clock}
        />
        <StatCard
          label="Paid this month"
          value={fmtGmd(paidMonth.reduce((s, p) => s + p.amount_gmd, 0))}
          sub={`${paidMonth.length} payouts`}
          icon={Banknote}
          tone="ink"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel
          title="Collectors owed"
          description={`Accepted kilograms not yet paid, at GMD ${state.settings.collectorRateGmdPerKg} per kg.`}
        >
          {owedCollectors.length === 0 && (
            <p className="text-sm text-muted-foreground">Every collector is paid up.</p>
          )}
          <ul className="divide-y">
            {owedCollectors.map((b) => (
              <li
                key={b.payee_user_id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
              >
                <span className="flex items-center gap-2">
                  <Truck className="size-4 text-primary" />
                  <span>
                    <b>{b.payee_name}</b>
                    <br />
                    <span className="text-xs text-muted-foreground">
                      {b.item_count} collections · {fmtKg(b.quantity)}
                    </span>
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <b className="tabular">{fmtGmd(b.amount_gmd)}</b>
                  <Button
                    size="sm"
                    disabled={!!busy}
                    onClick={() =>
                      act(
                        `c-${b.payee_user_id}`,
                        () =>
                          supabase.rpc("admin_create_collector_payout", {
                            _collector: b.payee_user_id!,
                          }),
                        (d) => `${ref(d)} created`,
                      )
                    }
                  >
                    {busy === `c-${b.payee_user_id}` && <Loader2 className="animate-spin" />}Create
                    payout
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel
          title="Partners owed"
          description="GMD value of vouchers residents redeemed with each partner."
        >
          {owedPartners.length === 0 && (
            <p className="text-sm text-muted-foreground">No unpaid vouchers.</p>
          )}
          <ul className="divide-y">
            {owedPartners.map((b) => (
              <li
                key={b.payee_name}
                className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
              >
                <span className="flex items-center gap-2">
                  <Store className="size-4 text-primary" />
                  <span>
                    <b>{b.payee_name}</b>
                    <br />
                    <span className="text-xs text-muted-foreground">
                      {fmtNum(b.item_count)} vouchers
                    </span>
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <b className="tabular">{fmtGmd(b.amount_gmd)}</b>
                  <Button
                    size="sm"
                    disabled={!!busy}
                    onClick={() =>
                      act(
                        `p-${b.payee_name}`,
                        () =>
                          supabase.rpc("admin_create_partner_payout", { _partner: b.payee_name }),
                        (d) => `${ref(d)} created`,
                      )
                    }
                  >
                    {busy === `p-${b.payee_name}` && <Loader2 className="animate-spin" />}Create
                    payout
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel
        title="Payout history"
        action={
          <div className="flex flex-wrap items-center gap-1.5">
            {(["all", "collector", "partner"] as const).map((k) => (
              <button key={k} className={chip(kindF === k)} onClick={() => setKindF(k)}>
                {k === "all" ? "All types" : k === "collector" ? "Collectors" : "Partners"}
              </button>
            ))}
            <span className="mx-1 h-4 w-px bg-border" />
            {(["all", "pending", "paid", "cancelled"] as const).map((s) => (
              <button key={s} className={chip(statusF === s)} onClick={() => setStatusF(s)}>
                {s === "all" ? "Any status" : STATUS[s].label}
              </button>
            ))}
            <Button variant="outline" size="sm" onClick={exportCsv} className="ml-1">
              <Download /> CSV
            </Button>
          </div>
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Payout</TableHead>
              <TableHead>Payee</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  No payouts yet.
                </TableCell>
              </TableRow>
            )}
            {list.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <p className="font-mono text-xs font-semibold">{p.ref}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(p.created_at), "d MMM yyyy")}
                  </p>
                </TableCell>
                <TableCell>
                  <p className="font-medium">{p.payee_name}</p>
                  <p className="text-xs capitalize text-muted-foreground">{p.kind}</p>
                </TableCell>
                <TableCell>
                  {qty(p)}
                  {p.kind === "collector" && p.rate !== null && (
                    <p className="text-xs text-muted-foreground">GMD {p.rate}/kg</p>
                  )}
                </TableCell>
                <TableCell className="font-semibold tabular">{fmtGmd(p.amount_gmd)}</TableCell>
                <TableCell>
                  <Badge variant={STATUS[p.status].variant}>{STATUS[p.status].label}</Badge>
                </TableCell>
                <TableCell className="text-xs">
                  {p.status === "paid" ? (
                    <>
                      {p.method}
                      {p.reference && (
                        <>
                          {" "}
                          · <span className="font-mono">{p.reference}</span>
                        </>
                      )}
                      <br />
                      <span className="text-muted-foreground">
                        {p.paid_at && format(new Date(p.paid_at), "d MMM yyyy HH:mm")}
                      </span>
                    </>
                  ) : p.status === "cancelled" ? (
                    <span className="text-muted-foreground">{p.note ?? "Cancelled"}</span>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {p.status === "pending" && (
                    <div className="flex justify-end gap-1.5">
                      <Button size="sm" onClick={() => openDialog("pay", p)}>
                        Mark paid
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openDialog("cancel", p)}>
                        Cancel
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          {dialog && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {dialog.mode === "pay"
                    ? `Mark ${dialog.payout.ref} paid`
                    : `Cancel ${dialog.payout.ref}`}
                </DialogTitle>
                <DialogDescription>
                  {dialog.payout.payee_name} · {qty(dialog.payout)} ·{" "}
                  <b>{fmtGmd(dialog.payout.amount_gmd)}</b>
                  {dialog.mode === "cancel" &&
                    ". Its items become unpaid again and can go into a new payout."}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                {dialog.mode === "pay" && (
                  <>
                    <label className="block text-sm font-medium">
                      Paid by
                      <select
                        className={cn(fieldCls, "mt-1.5")}
                        value={method}
                        onChange={(e) => setMethod(e.target.value)}
                      >
                        {METHODS.map((m) => (
                          <option key={m}>{m}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-sm font-medium">
                      Payment reference
                      {method === "Cash" && (
                        <span className="font-normal text-muted-foreground"> (optional)</span>
                      )}
                      <input
                        className={cn(fieldCls, "mt-1.5 font-mono")}
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                        placeholder={
                          method === "Mobile money"
                            ? "Transaction ID from the transfer"
                            : method === "Bank transfer"
                              ? "Bank transfer reference"
                              : "Receipt number"
                        }
                        maxLength={80}
                      />
                    </label>
                  </>
                )}
                <label className="block text-sm font-medium">
                  Note <span className="font-normal text-muted-foreground">(optional)</span>
                  <input
                    className={cn(fieldCls, "mt-1.5")}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={300}
                    placeholder={dialog.mode === "cancel" ? "Why it was cancelled" : ""}
                  />
                </label>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialog(null)}>
                  Back
                </Button>
                <Button
                  variant={dialog.mode === "cancel" ? "destructive" : "default"}
                  disabled={!!busy}
                  onClick={confirm}
                >
                  {busy && <Loader2 className="animate-spin" />}
                  {dialog.mode === "pay" ? "Confirm payment" : "Cancel payout"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
