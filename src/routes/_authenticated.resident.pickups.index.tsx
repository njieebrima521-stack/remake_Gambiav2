import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import {
  AlertTriangle,
  Bookmark,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MapPin,
  QrCode,
  Repeat,
  ScanLine,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, PageHeader, Panel, PickupStatusBadge } from "@/components/remake/ui";
import { LocationPickerMap, type Coordinates } from "@/components/remake/LocationPickerMap";
import { WasteScanner } from "@/components/remake/WasteScanner";
import { errorMessage } from "@/lib/remake/logic";
import { useRemake } from "@/lib/remake/store";
import { AREAS, MATERIALS, TIME_SLOTS, todayIso } from "@/lib/remake/data";
import {
  MATERIAL_TYPES,
  materialTypeById,
  materialTypeName,
  type MaterialTypeId,
} from "@/lib/remake/material-types";
import { bookPickupStreams, type BookedStream } from "@/lib/remake/services/booking";
import {
  listSavedLocations,
  saveLocation,
  type SavedLocation,
} from "@/lib/remake/services/locations";
import { fmtDate, fmtKg, fmtNum } from "@/lib/remake/format";
import type { MaterialId, PickupStatus } from "@/lib/remake/types";
import { cn } from "@/lib/utils";

type Search = {
  tab?: "book" | "history" | undefined;
  material?: MaterialId | undefined;
  types?: string | undefined;
  scanId?: string | undefined;
};

export const Route = createFileRoute("/_authenticated/resident/pickups/")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    tab: s["tab"] === "book" || s["tab"] === "history" ? s["tab"] : undefined,
    material:
      typeof s["material"] === "string" && s["material"] in MATERIALS
        ? (s["material"] as MaterialId)
        : undefined,
    types: typeof s["types"] === "string" && s["types"] ? s["types"] : undefined,
    scanId: typeof s["scanId"] === "string" && s["scanId"] ? s["scanId"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Pickups — Remake" },
      {
        name: "description",
        content: "Book a recyclables pickup in four steps and track every collection and receipt.",
      },
      { property: "og:title", content: "Book a pickup — Remake" },
      { property: "og:description", content: "Garbage handover made easy across Greater Banjul." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PickupsPage,
});

const inputCls =
  "h-11 w-full rounded-xl border bg-card px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

const STEPS = [
  { id: 1, label: "Materials" },
  { id: 2, label: "Photo" },
  { id: 3, label: "Date & Location" },
  { id: 4, label: "Review" },
] as const;

function defaultTypeFor(material?: MaterialId): MaterialTypeId {
  if (!material) return "pet";
  return MATERIAL_TYPES.find((m) => m.parent === material)?.id ?? "plastic_general";
}

function parseInitialTypes(typesParam?: string, materialParam?: MaterialId): MaterialTypeId[] {
  if (typesParam) {
    const valid = typesParam
      .split(",")
      .map((s) => s.trim())
      .filter((s): s is MaterialTypeId => !!materialTypeById(s));
    if (valid.length > 0) return Array.from(new Set(valid));
  }
  return [defaultTypeFor(materialParam)];
}

function PickupsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/resident/pickups/" });
  const tab = search.tab ?? (search.material || search.types ? "book" : "history");
  return (
    <div>
      <PageHeader
        eyebrow="Resident"
        title="Garbage handover"
        description="Book separated recyclable streams in four steps and show your QR code at collection."
      />
      <Tabs
        value={tab}
        onValueChange={(v) => navigate({ search: { tab: v as "book" | "history" } })}
      >
        <TabsList className="mb-6">
          <TabsTrigger value="history">My pickups</TabsTrigger>
          <TabsTrigger value="book">Book a pickup</TabsTrigger>
        </TabsList>
        <TabsContent value="book">
          <BookWizard
            key={`${search.material ?? ""}-${search.types ?? ""}-${search.scanId ?? ""}`}
            initialMaterial={search.material}
            initialTypes={search.types}
            initialScanId={search.scanId}
          />
        </TabsContent>
        <TabsContent value="history">
          <History />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BookWizard({
  initialMaterial,
  initialTypes,
  initialScanId,
}: {
  initialMaterial?: MaterialId | undefined;
  initialTypes?: string | undefined;
  initialScanId?: string | undefined;
}) {
  const { state, bookPickup, refresh } = useRemake();
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [streams, setStreams] = useState<Record<MaterialTypeId, number>>(() => {
    const picked = parseInitialTypes(initialTypes, initialMaterial);
    return Object.fromEntries(picked.map((t) => [t, 2])) as Record<MaterialTypeId, number>;
  });
  const [separationConfirmed, setSeparationConfirmed] = useState(false);
  const [scanId, setScanId] = useState<string | null>(initialScanId ?? null);

  const [date, setDate] = useState<Date | undefined>(() => addDays(new Date(), 1));
  const [slot, setSlot] = useState<string>(TIME_SLOTS[1]!);
  const [address, setAddress] = useState(state.profile.address);
  const [area, setArea] = useState(state.profile.area);
  const [coords, setCoords] = useState<Coordinates>({
    lat: null,
    lng: null,
    source: "manual",
  });
  const [notes, setNotes] = useState("");
  const [saveAddressChecked, setSaveAddressChecked] = useState(false);
  const [saveAddressLabel, setSaveAddressLabel] = useState("Home");
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
  const [selectedSavedId, setSelectedSavedId] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [bookedResult, setBookedResult] = useState<{
    refs: string[];
    streams: BookedStream[] | null;
  } | null>(null);

  // Sync profile address once hydrated without overwriting manual edits.
  const [profileSynced, setProfileSynced] = useState(false);
  useEffect(() => {
    if (!profileSynced && (state.profile.address || state.profile.area)) {
      if (!address) setAddress(state.profile.address);
      if (state.profile.area) setArea(state.profile.area);
      setProfileSynced(true);
    }
  }, [state.profile.address, state.profile.area, profileSynced, address]);

  useEffect(() => {
    listSavedLocations()
      .then((locs) => {
        setSavedLocations(locs);
        const def = locs.find((l) => l.isDefault);
        if (def && !selectedSavedId) {
          setSelectedSavedId(def.id);
          setAddress(def.address);
          setArea(def.area);
          setCoords({ lat: def.lat, lng: def.lng, source: "saved" });
        }
      })
      .catch(() => {
        /* saved locations unavailable when backend not connected */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const streamEntries = useMemo(
    () =>
      Object.entries(streams)
        .filter(([, bags]) => bags > 0)
        .map(([type, bags]) => ({
          materialType: type as MaterialTypeId,
          bags,
          info: materialTypeById(type)!,
        })),
    [streams],
  );

  const toggleStream = (id: MaterialTypeId) => {
    const info = materialTypeById(id);
    if (info && !state.rates[info.parent].active) {
      toast.error(`${info.name} is paused right now.`);
      return;
    }
    setStreams((prev) => {
      const next = { ...prev };
      if (next[id]) {
        delete next[id];
      } else {
        next[id] = 2;
      }
      return next;
    });
  };

  const setStreamBags = (id: MaterialTypeId, bags: number) => {
    const safe = Math.max(1, Math.min(20, Number.isFinite(bags) ? Math.round(bags) : 1));
    setStreams((prev) => ({ ...prev, [id]: safe }));
  };

  const applySavedLocation = (loc: SavedLocation) => {
    setSelectedSavedId(loc.id);
    setAddress(loc.address);
    setArea(loc.area);
    setCoords({ lat: loc.lat, lng: loc.lng, source: "saved" });
  };

  const validateStep = (target: 1 | 2 | 3 | 4): boolean => {
    if (target > 1) {
      if (streamEntries.length === 0) {
        toast.error("Select at least one material stream");
        return false;
      }
      if (streamEntries.some((s) => s.bags < 1 || s.bags > 20)) {
        toast.error("Bag count per stream must be between 1 and 20");
        return false;
      }
      if (streamEntries.length > 1 && !separationConfirmed) {
        toast.error("Confirm that different materials are physically separated");
        return false;
      }
    }
    if (target > 3) {
      if (!date) {
        toast.error("Choose a pickup date");
        return false;
      }
      if (!address.trim()) {
        toast.error("Enter a pickup address or select a saved location");
        return false;
      }
    }
    return true;
  };

  const goStep = (next: 1 | 2 | 3 | 4) => {
    if (next > step && !validateStep(next)) return;
    setStep(next);
  };

  const submit = async () => {
    if (busy || !validateStep(4) || !date) return;
    setBusy(true);
    try {
      const dateStr = format(date, "yyyy-MM-dd");
      if (saveAddressChecked && address.trim()) {
        await saveLocation({
          label: saveAddressLabel.trim() || "Saved address",
          address: address.trim(),
          area,
          lat: coords.lat,
          lng: coords.lng,
          isDefault: savedLocations.length === 0,
        }).catch(() => {
          /* ignore if saved locations backend isn't active yet */
        });
      }

      try {
        const res = await bookPickupStreams({
          streams: streamEntries.map((s) => ({ materialType: s.materialType, bags: s.bags })),
          date: dateStr,
          slot,
          location: {
            address: address.trim(),
            area,
            lat: coords.lat,
            lng: coords.lng,
            source: coords.source,
            accuracyM: coords.accuracyM,
          },
          notes: notes.trim(),
          scanId,
          separationConfirmed: streamEntries.length > 1 ? separationConfirmed : true,
          clientRequestId: requestId,
        });
        setBookedResult({
          refs: res.streams.map((s) => s.ref),
          streams: res.streams,
        });
        await refresh();
      } catch (err) {
        // If multi-stream RPC isn't connected yet and this is a single stream, try legacy bookPickup
        if (streamEntries.length === 1) {
          const only = streamEntries[0]!;
          const ref = await bookPickup({
            material: only.info.parent,
            bags: only.bags,
            date: dateStr,
            slot,
            address: address.trim(),
            area,
            notes: notes.trim() || undefined,
            clientRequestId: requestId,
          });
          setBookedResult({ refs: [ref], streams: null });
        } else {
          throw err;
        }
      }
      setRequestId(crypto.randomUUID());
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const resetWizard = () => {
    setBookedResult(null);
    setStep(1);
    setNotes("");
  };

  return (
    <div className="space-y-6">
      <nav aria-label="Booking steps" className="grid grid-cols-4 gap-2">
        {STEPS.map((s) => {
          const active = step === s.id;
          const done = step > s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => (s.id < step || validateStep(s.id)) && setStep(s.id)}
              className={cn(
                "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-medium transition sm:text-sm",
                active
                  ? "border-primary bg-mint text-mint-foreground ring-2 ring-primary/20"
                  : done
                    ? "border-primary/40 bg-card text-foreground"
                    : "bg-card text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold",
                  active || done
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {done ? <Check className="size-3.5" /> : s.id}
              </span>
              <span className="truncate">{s.label}</span>
            </button>
          );
        })}
      </nav>

      {step === 1 && (
        <Panel
          title="1 · Materials"
          description="Select each material stream you have sorted for collection."
          action={
            <Button asChild variant="outline" size="sm">
              <Link to="/resident/scan">
                <ScanLine className="size-4" /> Open scanner
              </Link>
            </Button>
          }
        >
          <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-mint/70 p-3 text-xs text-mint-foreground">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              Different materials must be physically separated into different bags or containers.
              Each selected material is booked as its own stream.
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {MATERIAL_TYPES.map((mt) => {
              const bags = streams[mt.id];
              const selected = !!bags;
              const active = state.rates[mt.parent].active;
              return (
                <div
                  key={mt.id}
                  className={cn(
                    "rounded-2xl border p-3.5 transition",
                    selected ? "border-primary bg-mint/40 ring-2 ring-primary/20" : "bg-card",
                    !active && "opacity-60",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => toggleStream(mt.id)}
                      className="flex-1 text-left"
                    >
                      <p className="font-display text-sm font-semibold">{mt.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {active
                          ? `${state.rates[mt.parent].pointsPerKg} coins/kg when verified`
                          : "Paused"}
                      </p>
                    </button>
                    <Checkbox
                      checked={selected}
                      disabled={!active}
                      onCheckedChange={() => toggleStream(mt.id)}
                      aria-label={`Select ${mt.name}`}
                    />
                  </div>
                  {selected && (
                    <div className="mt-3 flex items-center justify-between border-t pt-2.5 text-xs">
                      <span className="text-muted-foreground">Bags / containers</span>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={bags}
                        onChange={(e) => setStreamBags(mt.id, Number(e.target.value))}
                        aria-label={`Bags for ${mt.name}`}
                        className="h-8 w-16 rounded-lg border bg-card px-2 text-center text-sm font-semibold"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {streamEntries.length > 1 && (
            <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border bg-muted/40 p-3.5 text-sm">
              <Checkbox
                checked={separationConfirmed}
                onCheckedChange={(v) => setSeparationConfirmed(!!v)}
                className="mt-0.5"
              />
              <span>
                I confirm these {streamEntries.length} materials are packed in separate bags or
                containers.
              </span>
            </label>
          )}

          <div className="mt-6 flex justify-end">
            <Button type="button" onClick={() => goStep(2)}>
              Continue to photo <ChevronRight className="size-4" />
            </Button>
          </div>
        </Panel>
      )}

      {step === 2 && (
        <Panel
          title="2 · Photo & confirmation"
          description="Take or upload a real photo to verify categories, or skip straight to scheduling."
        >
          <WasteScanner
            compact
            confirmLabel="Apply detected materials"
            onConfirmed={({ scanId: sid, categories }) => {
              setScanId(sid);
              if (categories.length > 0) {
                setStreams((prev) => {
                  const next = { ...prev };
                  for (const cat of categories) {
                    const info = materialTypeById(cat);
                    if (info && state.rates[info.parent].active && !next[cat]) {
                      next[cat] = 1;
                    }
                  }
                  return next;
                });
                toast.success("Confirmed materials added to your streams");
              }
              setStep(3);
            }}
          />

          <div className="mt-6 flex flex-wrap justify-between gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={() => setStep(1)}>
              <ChevronLeft className="size-4" /> Back
            </Button>
            <Button type="button" onClick={() => goStep(3)}>
              Continue without photo <ChevronRight className="size-4" />
            </Button>
          </div>
        </Panel>
      )}

      {step === 3 && (
        <div className="grid gap-6 xl:grid-cols-[1fr_1.3fr]">
          <Panel title="3 · Date & time">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              disabled={{ before: parseISO(todayIso()) }}
              defaultMonth={parseISO(todayIso())}
              className="mx-auto rounded-xl border"
            />
            <div className="mt-4 grid grid-cols-2 gap-2">
              {TIME_SLOTS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSlot(s)}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-sm",
                    slot === s
                      ? "border-primary bg-mint font-semibold text-mint-foreground"
                      : "hover:bg-muted",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="Pickup location">
            {savedLocations.length > 0 && (
              <div className="mb-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Saved addresses
                </p>
                <div className="flex flex-wrap gap-2">
                  {savedLocations.map((loc) => (
                    <button
                      key={loc.id}
                      type="button"
                      onClick={() => applySavedLocation(loc)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium",
                        selectedSavedId === loc.id
                          ? "border-primary bg-mint text-mint-foreground"
                          : "bg-card hover:bg-muted",
                      )}
                    >
                      <Bookmark className="size-3" />
                      {loc.label} ({loc.area})
                    </button>
                  ))}
                </div>
              </div>
            )}

            <LocationPickerMap
              value={coords}
              onChange={(next) => {
                setSelectedSavedId(null);
                setCoords(next);
              }}
            />

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="text-sm font-medium md:col-span-2">
                Pickup address
                <input
                  value={address}
                  onChange={(e) => {
                    setSelectedSavedId(null);
                    setAddress(e.target.value);
                  }}
                  placeholder="Street, compound or landmark"
                  className={cn(inputCls, "mt-1.5")}
                />
              </label>

              <label className="text-sm font-medium">
                Area
                <select
                  value={area}
                  onChange={(e) => {
                    setSelectedSavedId(null);
                    setArea(e.target.value);
                  }}
                  className={cn(inputCls, "mt-1.5")}
                >
                  {AREAS.map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-medium">
                Notes (optional)
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Blue gate, bags by wall"
                  className={cn(inputCls, "mt-1.5")}
                />
              </label>
            </div>

            <div className="mt-4 rounded-xl border bg-muted/30 p-3">
              <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                <Checkbox
                  checked={saveAddressChecked}
                  onCheckedChange={(v) => setSaveAddressChecked(!!v)}
                />
                <span>Save this address for future pickups</span>
              </label>
              {saveAddressChecked && (
                <input
                  value={saveAddressLabel}
                  onChange={(e) => setSaveAddressLabel(e.target.value)}
                  placeholder="Label (e.g. Home, Office)"
                  className={cn(inputCls, "mt-2")}
                />
              )}
            </div>

            <div className="mt-6 flex flex-wrap justify-between gap-2 border-t pt-4">
              <Button type="button" variant="outline" onClick={() => setStep(2)}>
                <ChevronLeft className="size-4" /> Back
              </Button>
              <Button type="button" onClick={() => goStep(4)}>
                Review booking <ChevronRight className="size-4" />
              </Button>
            </div>
          </Panel>
        </div>
      )}

      {step === 4 && (
        <Panel title="4 · Review & confirm" description="Check your details before submitting.">
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Material streams ({streamEntries.length})
              </p>
              <ul className="divide-y rounded-2xl border">
                {streamEntries.map((s) => (
                  <li
                    key={s.materialType}
                    className="flex items-center justify-between px-4 py-3 text-sm"
                  >
                    <span className="font-medium">{s.info.name}</span>
                    <Badge variant="muted">
                      {s.bags} bag{s.bags === 1 ? "" : "s"}
                    </Badge>
                  </li>
                ))}
              </ul>
              {scanId && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Confirmed scan attached ({scanId.slice(0, 8)}…)
                </p>
              )}
            </div>

            <dl className="divide-y rounded-2xl border text-sm">
              <div className="flex justify-between gap-4 px-4 py-3">
                <dt className="text-muted-foreground">Date</dt>
                <dd className="font-medium">{date ? fmtDate(format(date, "yyyy-MM-dd")) : "—"}</dd>
              </div>
              <div className="flex justify-between gap-4 px-4 py-3">
                <dt className="text-muted-foreground">Time slot</dt>
                <dd className="font-medium">{slot}</dd>
              </div>
              <div className="flex justify-between gap-4 px-4 py-3">
                <dt className="text-muted-foreground">Address</dt>
                <dd className="text-right font-medium">
                  {address}, {area}
                </dd>
              </div>
              <div className="flex justify-between gap-4 px-4 py-3">
                <dt className="text-muted-foreground">Coordinates</dt>
                <dd className="font-mono text-xs">
                  {coords.lat != null && coords.lng != null
                    ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`
                    : "Manual address only"}
                </dd>
              </div>
              {notes.trim() && (
                <div className="flex justify-between gap-4 px-4 py-3">
                  <dt className="text-muted-foreground">Notes</dt>
                  <dd className="text-right">{notes}</dd>
                </div>
              )}
            </dl>
          </div>

          <div className="mt-6 flex flex-wrap justify-between gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={() => setStep(3)}>
              <ChevronLeft className="size-4" /> Back
            </Button>
            <Button type="button" size="lg" onClick={submit} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <Truck />} Confirm booking
            </Button>
          </div>
        </Panel>
      )}

      <Dialog open={!!bookedResult} onOpenChange={(o) => !o && resetWizard()}>
        <DialogContent className="max-w-md text-center">
          <CheckCircle2 className="mx-auto size-14 text-primary" />
          <DialogTitle className="font-display text-2xl">Booking confirmed</DialogTitle>
          {bookedResult && (
            <>
              <p className="text-sm text-muted-foreground">
                Green Coins stay pending after weighing and become available only once a processor
                verifies accepted weight.
              </p>
              {bookedResult.streams ? (
                <ul className="divide-y rounded-2xl border text-left text-sm">
                  {bookedResult.streams.map((s) => (
                    <li key={s.ref} className="flex items-center justify-between gap-2 px-4 py-2.5">
                      <div>
                        <p className="font-semibold">
                          {materialTypeName(s.materialType)} ·{" "}
                          <span className="font-mono text-xs">{s.ref}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {s.institution ?? "Awaiting routing"}
                          {s.collector ? ` · ${s.collector}` : ""}
                        </p>
                      </div>
                      <Badge variant={s.assignmentStatus === "assigned" ? "success" : "muted"}>
                        {s.assignmentStatus}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="font-mono text-sm font-semibold">{bookedResult.refs.join(", ")}</p>
              )}
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => navigate({ to: "/resident" })}>
                  Back to home
                </Button>
                {bookedResult.refs[0] && (
                  <Button
                    onClick={() =>
                      navigate({
                        to: "/resident/pickups/$id",
                        params: { id: bookedResult.refs[0]! },
                      })
                    }
                  >
                    <QrCode /> View QR
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

const FILTERS: { key: "all" | PickupStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "scheduled", label: "Scheduled" },
  { key: "collected", label: "Collected" },
  { key: "batched", label: "Batched" },
  { key: "verified", label: "Verified" },
  { key: "rejected", label: "Rejected" },
];

function History() {
  const { state } = useRemake();
  const [f, setF] = useState<(typeof FILTERS)[number]["key"]>("all");
  const mine = state.pickups
    .filter((p) => p.mine && (f === "all" || p.status === f))
    .sort((a, b) => b.date.localeCompare(a.date));
  return (
    <Panel
      title="Pickup history"
      action={
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((x) => (
            <button
              key={x.key}
              onClick={() => setF(x.key)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold",
                f === x.key
                  ? "bg-ink text-ink-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/70",
              )}
            >
              {x.label}
            </button>
          ))}
        </div>
      }
    >
      {mine.length === 0 ? (
        <EmptyState icon={Truck} title="No pickups here">
          Book a pickup to get started.
        </EmptyState>
      ) : (
        <ul className="divide-y">
          {mine.map((p) => (
            <li key={p.id}>
              <Link
                to="/resident/pickups/$id"
                params={{ id: p.id }}
                className="flex items-center gap-4 py-3 hover:bg-muted/40"
              >
                <img
                  src={MATERIALS[p.material].image}
                  alt=""
                  className="size-12 rounded-xl object-cover"
                  loading="lazy"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {p.materialType ? materialTypeName(p.materialType) : MATERIALS[p.material].name}{" "}
                    · {p.bags} bags{" "}
                    <span className="font-mono text-xs text-muted-foreground">{p.id}</span>
                  </p>
                  <p className="flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="size-3.5" />
                    {fmtDate(p.date)} · {p.slot}
                    {p.recurring && <Repeat className="size-3.5" />}
                  </p>
                </div>
                <div className="hidden text-right text-sm sm:block">
                  {p.weightKg ? (
                    <p className="font-semibold">{fmtKg(p.weightKg)}</p>
                  ) : (
                    <p className="text-muted-foreground">Not weighed</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {p.pointsAwarded
                      ? `+${fmtNum(p.pointsAwarded)} coins`
                      : p.pointsPending
                        ? `${fmtNum(p.pointsPending)} pending`
                        : ""}
                  </p>
                </div>
                <PickupStatusBadge status={p.status} />
                <ChevronRight className="size-4 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
