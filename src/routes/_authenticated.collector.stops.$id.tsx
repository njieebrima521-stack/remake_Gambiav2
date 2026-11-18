import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  CloudOff,
  ImageIcon,
  Loader2,
  MapPin,
  Phone,
  QrCode,
  Scale,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, PickupStatusBadge, ReceiptCard } from "@/components/remake/ui";
import { QrScanner } from "@/components/remake/QrScanner";
import { useRemake } from "@/lib/remake/store";
import { MATERIALS } from "@/lib/remake/data";
import { errorMessage, isValidWeight, pointsFor } from "@/lib/remake/logic";
import { fmtDate } from "@/lib/remake/format";
import { materialTypeName } from "@/lib/remake/material-types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/collector/stops/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Stop ${params.id} — Remake Collector` },
      {
        name: "description",
        content: "Check the pickup QR code, weigh materials and issue a receipt.",
      },
      { property: "og:title", content: `Stop ${params.id} — Remake Collector` },
      { property: "og:description", content: "Collection stop details." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StopPage,
});

const REASONS = [
  "Waste mixed with food residue",
  "Customer not home",
  "Wrong material category",
  "Hazardous items found",
];
const inputCls =
  "h-11 w-full rounded-xl border bg-card px-3 font-mono text-sm uppercase outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

function StopPage() {
  const { id } = Route.useParams();
  const { state, recordWeight, rejectPickup, verifyPickupCode, uploadCollectionPhoto } =
    useRemake();
  const p = state.pickups.find((x) => x.id === id && x.assignedToMe);
  const [code, setCode] = useState("");
  const [scan, setScan] = useState<"idle" | "checking" | "ok">("idle");
  const [kg, setKg] = useState("");
  const [reason, setReason] = useState<string>(REASONS[0]!);
  const [mode, setMode] = useState<"accept" | "reject">("accept");
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [camera, setCamera] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!p)
    return (
      <div className="rounded-2xl border border-dashed p-10 text-center">
        Stop {id} isn't on your route.{" "}
        <Link to="/collector/today" className="font-semibold text-primary">
          Back to route
        </Link>
      </div>
    );
  const m = MATERIALS[p.material];
  const materialLabel = p.materialType ? materialTypeName(p.materialType) : m.name;
  const open = p.status === "scheduled";
  const offline = state.collectorOffline;
  // Offline, the code is checked against the copy on this device and re-checked by the server on sync.
  const verified = scan === "ok" || !open;
  const weight = Number(kg);

  const doCheck = async (value: string = code) => {
    if (!value.trim()) {
      toast.error("Enter or scan the code on the resident's QR");
      return;
    }
    setScan("checking");
    try {
      if (offline) {
        const c = value.trim().toUpperCase();
        if (c !== p.code.toUpperCase() && c !== p.id.toUpperCase())
          throw new Error("This code does not match the pickup.");
      } else {
        await verifyPickupCode(p.id, value);
      }
      setScan("ok");
      toast.success(`Code matched ${p.id}`);
    } catch (e) {
      setScan("idle");
      toast.error(errorMessage(e));
    }
  };

  const onScanned = (text: string) => {
    setCamera(false);
    setCode(text);
    void doCheck(text);
  };

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    if (offline) {
      toast.error("Photos can only be attached when you're online");
      return;
    }
    setUploading(true);
    try {
      const path = await uploadCollectionPhoto(file);
      setPhotoPath(path);
      setPhotoUrl(URL.createObjectURL(file));
      toast.success("Photo attached");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (mode === "accept") {
        if (!isValidWeight(weight)) {
          toast.error("Enter a weight between 0.1 and 500 kg");
          return;
        }
        await recordWeight(p.id, weight, photoPath ?? undefined);
        toast.success(`Recorded ${weight} kg${offline ? " · saved offline" : ""}`);
      } else {
        await rejectPickup(p.id, reason);
        toast(`Pickup ${p.id} rejected${offline ? " · saved offline" : ""}`);
      }
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
        <Link to="/collector/today">
          <ArrowLeft /> Route
        </Link>
      </Button>
      <PageHeader
        eyebrow={`Stop ${p.id}`}
        title={p.customer}
        description={`${materialLabel} · ${p.bags} bags · ${fmtDate(p.date)} ${p.slot}`}
        actions={
          <>
            {p.unsynced && (
              <span className="flex items-center gap-1 text-sm font-semibold text-warning">
                <CloudOff className="size-4" /> Unsynced
              </span>
            )}
            <PickupStatusBadge status={p.status} />
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <div className="space-y-6">
          <Panel title="Stop details">
            <dl className="space-y-3 text-sm">
              <div className="flex gap-2">
                <MapPin className="size-4 shrink-0 text-primary" />
                <div>
                  <p>
                    {p.address}, {p.area}
                  </p>
                  {p.lat != null && p.lng != null && (
                    <p className="font-mono text-xs text-muted-foreground">
                      GPS: {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Phone className="size-4 shrink-0 text-primary" />
                {p.phone || "No phone on file"}
              </div>
              {p.notes && <div className="rounded-xl bg-muted p-3">“{p.notes}”</div>}
              <div className="flex items-center gap-3 rounded-xl border p-3">
                <img src={m.image} alt="" className="size-12 rounded-lg object-cover" />
                <div>
                  <p className="font-semibold">{materialLabel}</p>
                  <p className="text-xs text-muted-foreground">{m.examples}</p>
                </div>
              </div>
            </dl>
          </Panel>
          <Panel
            title="1 · Check pickup QR"
            description="Scan the resident's QR with the camera, or type the code shown under it."
          >
            <div
              className={cn(
                "relative grid aspect-video place-items-center overflow-hidden rounded-2xl",
                verified ? "bg-mint" : "bg-ink",
              )}
            >
              {verified ? (
                <div className="text-center text-mint-foreground">
                  <CheckCircle2 className="mx-auto size-10" />
                  <p className="mt-1 font-mono text-sm font-semibold">{p.code}</p>
                </div>
              ) : camera ? (
                <QrScanner onResult={onScanned} onError={(m) => toast.error(m)} />
              ) : (
                <>
                  <QrCode className="size-16 text-ink-muted" />
                  <div className="absolute inset-6 rounded-xl border-2 border-dashed border-primary" />
                  {scan === "checking" && (
                    <div className="absolute inset-x-6 top-1/2 h-0.5 animate-pulse bg-primary" />
                  )}
                </>
              )}
              {camera && !verified && (
                <button
                  onClick={() => setCamera(false)}
                  className="absolute right-2 top-2 grid size-9 place-items-center rounded-full bg-ink/70 text-ink-foreground"
                  aria-label="Close camera"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
            {open && scan !== "ok" && (
              <div className="mt-4 space-y-2">
                {!camera && (
                  <Button
                    className="w-full"
                    variant="secondary"
                    onClick={() => setCamera(true)}
                    disabled={scan === "checking"}
                  >
                    <Camera /> Scan with camera
                  </Button>
                )}
                <div className="flex gap-2">
                  <input
                    className={inputCls}
                    placeholder="RMK-PU-…"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && doCheck()}
                    aria-label="Pickup code"
                  />
                  <Button onClick={() => doCheck()} disabled={scan === "checking"}>
                    {scan === "checking" ? <Loader2 className="animate-spin" /> : "Verify"}
                  </Button>
                </div>
              </div>
            )}
          </Panel>
          {open && (
            <Panel
              title="2 · Photo evidence"
              description="Optional, but helps if the load is disputed."
            >
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => onPhoto(e.target.files?.[0])}
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className={cn(
                  "relative grid aspect-video w-full place-items-center overflow-hidden rounded-2xl border-2 border-dashed",
                  photoPath
                    ? "border-primary bg-mint text-mint-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {photoUrl && (
                  <img
                    src={photoUrl}
                    alt="Collection evidence"
                    className="absolute inset-0 size-full object-cover opacity-40"
                  />
                )}
                <span className="relative text-center">
                  {uploading ? (
                    <Loader2 className="mx-auto size-8 animate-spin" />
                  ) : (
                    <ImageIcon className="mx-auto size-8" />
                  )}
                  <span className="mt-1 block text-sm font-medium">
                    {photoPath ? "Photo attached · tap to retake" : "Tap to take or add a photo"}
                  </span>
                </span>
              </button>
            </Panel>
          )}
        </div>
        <div className="space-y-6">
          {open ? (
            <Panel title="3 · Weigh & record">
              <div className="mb-4 grid grid-cols-2 gap-2">
                <button
                  onClick={() => setMode("accept")}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-xl border p-3 font-semibold",
                    mode === "accept"
                      ? "border-primary bg-mint text-mint-foreground"
                      : "hover:bg-muted",
                  )}
                >
                  <CheckCircle2 className="size-4" /> Accept
                </button>
                <button
                  onClick={() => setMode("reject")}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-xl border p-3 font-semibold",
                    mode === "reject"
                      ? "border-destructive bg-danger-soft text-destructive"
                      : "hover:bg-muted",
                  )}
                >
                  <XCircle className="size-4" /> Reject
                </button>
              </div>
              {mode === "accept" ? (
                <>
                  <label className="text-sm font-medium">Scale reading (kg)</label>
                  <div className="mt-1.5 flex items-center gap-3 rounded-2xl bg-ink p-5 text-ink-foreground">
                    <Scale className="size-7 text-primary" />
                    <input
                      inputMode="decimal"
                      value={kg}
                      onChange={(e) => setKg(e.target.value.replace(/[^0-9.]/g, ""))}
                      placeholder="0.0"
                      className="w-full bg-transparent font-display text-4xl font-semibold outline-none placeholder:text-ink-muted"
                      aria-label="Weight in kg"
                    />
                    <span className="text-ink-muted">kg</span>
                  </div>
                  {p.ownerType === "resident" && weight > 0 && (
                    <p className="mt-4 rounded-xl bg-mint p-3 text-sm text-mint-foreground">
                      Resident will see about{" "}
                      <b>
                        {pointsFor(state.rates[p.material].pointsPerKg, weight)} pending Green Coins
                      </b>{" "}
                      until a processor verifies the load.
                    </p>
                  )}
                </>
              ) : (
                <div className="space-y-2">
                  {REASONS.map((r) => (
                    <label
                      key={r}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm",
                        reason === r && "border-destructive bg-danger-soft",
                      )}
                    >
                      <input
                        type="radio"
                        checked={reason === r}
                        onChange={() => setReason(r)}
                        className="accent-destructive"
                      />
                      {r}
                    </label>
                  ))}
                </div>
              )}
              <Button
                size="lg"
                className="mt-5 w-full"
                variant={mode === "accept" ? "default" : "destructive"}
                disabled={!verified || busy}
                onClick={submit}
              >
                {busy && <Loader2 className="animate-spin" />}
                {!verified
                  ? "Check the QR code first"
                  : mode === "accept"
                    ? "Record weight & issue receipt"
                    : "Reject pickup"}
              </Button>
            </Panel>
          ) : p.status === "rejected" ? (
            <Panel title="Rejected">
              <p className="text-sm text-destructive">{p.rejectReason}</p>
            </Panel>
          ) : (
            <ReceiptCard pickup={p} />
          )}
        </div>
      </div>
    </div>
  );
}
