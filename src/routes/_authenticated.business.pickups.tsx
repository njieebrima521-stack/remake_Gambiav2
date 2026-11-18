import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Repeat } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader, Panel, PickupStatusBadge } from "@/components/remake/ui";
import { errorMessage } from "@/lib/remake/logic";
import { addDays, format } from "date-fns";
import { useRemake } from "@/lib/remake/store";
import { MATERIAL_LIST, MATERIALS, TIME_SLOTS, todayIso } from "@/lib/remake/data";
import { fmtDate, fmtKg } from "@/lib/remake/format";
import type { MaterialId } from "@/lib/remake/types";

export const Route = createFileRoute("/_authenticated/business/pickups")({
  head: () => ({
    meta: [
      { title: "Recurring Pickups — Remake Business" },
      {
        name: "description",
        content: "Schedule recurring commercial pickups and review collection history.",
      },
      { property: "og:title", content: "Recurring Pickups — Remake Business" },
      {
        property: "og:description",
        content: "Commercial recycling pickups across Greater Banjul.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BizPickups,
});

const inputCls =
  "mt-1.5 h-11 w-full rounded-xl border bg-card px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";
type Freq = "Weekly" | "Fortnightly" | "Monthly";

function BizPickups() {
  const { state, bookPickup } = useRemake();
  const [material, setMaterial] = useState<MaterialId>("plastic");
  const [bags, setBags] = useState(10);
  const [date, setDate] = useState(() => format(addDays(new Date(), 7), "yyyy-MM-dd"));
  const [busy, setBusy] = useState(false);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const org = state.me?.orgs.find((o) => o.kind === "business");
  const [address, setAddress] = useState("");
  const addr = address || org?.address || state.profile.address;
  const [slot, setSlot] = useState<string>(TIME_SLOTS[0]!);
  const [freq, setFreq] = useState<Freq>("Weekly");
  const mine = state.pickups
    .filter((p) => p.mineBusiness)
    .sort((a, b) => b.date.localeCompare(a.date));
  const submit = async () => {
    if (date < todayIso()) {
      toast.error("Choose a future date");
      return;
    }
    if (bags < 1 || bags > 50) {
      toast.error("Bags must be between 1 and 50");
      return;
    }
    if (!addr.trim()) {
      toast.error("Enter the pickup address");
      return;
    }
    setBusy(true);
    try {
      const ref = await bookPickup({
        material,
        bags,
        date,
        slot,
        address: addr.trim(),
        area: org?.area || state.profile.area,
        frequency: freq,
        clientRequestId: requestId,
      });
      setRequestId(crypto.randomUUID());
      toast.success(`${freq} ${MATERIALS[material].name.toLowerCase()} pickup scheduled`, {
        description: `${ref} · assigned to the collector route.`,
      });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-6">
      <PageHeader eyebrow={org?.name ?? "Business"} title="Recurring pickups" />
      <Panel title="Schedule a recurring pickup">
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          <label className="text-sm font-medium xl:col-span-2">
            Material
            <select
              className={inputCls}
              value={material}
              onChange={(e) => setMaterial(e.target.value as MaterialId)}
            >
              {MATERIAL_LIST.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            Bags
            <input
              type="number"
              min={1}
              className={inputCls}
              value={bags}
              onChange={(e) => setBags(Number(e.target.value))}
            />
          </label>
          <label className="text-sm font-medium">
            First pickup
            <input
              type="date"
              min={todayIso()}
              className={inputCls}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label className="text-sm font-medium">
            Time
            <select className={inputCls} value={slot} onChange={(e) => setSlot(e.target.value)}>
              {TIME_SLOTS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            Frequency
            <select
              className={inputCls}
              value={freq}
              onChange={(e) => setFreq(e.target.value as Freq)}
            >
              {["Weekly", "Fortnightly", "Monthly"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="mt-4 block text-sm font-medium">
          Pickup address
          <input className={inputCls} value={addr} onChange={(e) => setAddress(e.target.value)} />
        </label>
        <Button className="mt-5" onClick={submit} disabled={busy}>
          <Repeat /> Schedule pickup
        </Button>
      </Panel>
      <Panel title="Collection history">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pickup</TableHead>
              <TableHead>Material</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Bags</TableHead>
              <TableHead>Weight</TableHead>
              <TableHead>Frequency</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mine.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  No pickups yet.
                </TableCell>
              </TableRow>
            )}
            {mine.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-xs">{p.id}</TableCell>
                <TableCell>{MATERIALS[p.material].name}</TableCell>
                <TableCell>{fmtDate(p.date)}</TableCell>
                <TableCell>{p.bags}</TableCell>
                <TableCell>{p.weightKg ? fmtKg(p.weightKg) : "—"}</TableCell>
                <TableCell>{p.frequency ?? "One-off"}</TableCell>
                <TableCell>
                  <PickupStatusBadge status={p.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </div>
  );
}
