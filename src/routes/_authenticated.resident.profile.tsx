import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bookmark, Leaf, Loader2, MapPin, Plus, Scale, Trash2, Truck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { PageHeader, Panel, StatCard } from "@/components/remake/ui";
import { LocationPickerMap, type Coordinates } from "@/components/remake/LocationPickerMap";
import { errorMessage } from "@/lib/remake/logic";
import { fmtDate, fmtKg } from "@/lib/remake/format";
import { useRemake } from "@/lib/remake/store";
import { AREAS } from "@/lib/remake/data";
import {
  deleteSavedLocation,
  listSavedLocations,
  saveLocation,
  type SavedLocation,
} from "@/lib/remake/services/locations";
import type { RemakeState } from "@/lib/remake/types";

export const Route = createFileRoute("/_authenticated/resident/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Remake" },
      {
        name: "description",
        content: "Manage your Remake resident profile, saved pickup addresses and alerts.",
      },
      { property: "og:title", content: "Profile — Remake" },
      { property: "og:description", content: "Your Remake resident profile." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

const inputCls =
  "mt-1.5 h-11 w-full rounded-xl border bg-card px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

function ProfilePage() {
  const { state, updateProfile } = useRemake();
  const [form, setForm] = useState<RemakeState["profile"]>(state.profile);
  useEffect(() => setForm(state.profile), [state.profile]);
  const mine = state.pickups.filter((p) => p.mine);
  const kg = mine.reduce((s, p) => s + (p.weightKg ?? 0), 0);
  const [saving, setSaving] = useState(false);

  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
  const [locStatus, setLocStatus] = useState<"loading" | "ready" | "unavailable">("loading");
  const [newLabel, setNewLabel] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newArea, setNewArea] = useState<string>(AREAS[0]!);
  const [newDefault, setNewDefault] = useState(false);
  const [newCoords, setNewCoords] = useState<Coordinates>({
    lat: null,
    lng: null,
    source: "manual",
  });
  const [savingLoc, setSavingLoc] = useState(false);

  const loadLocations = () => {
    listSavedLocations()
      .then((rows) => {
        setSavedLocations(rows);
        setLocStatus("ready");
      })
      .catch(() => {
        setLocStatus("unavailable");
      });
  };

  useEffect(() => {
    loadLocations();
  }, []);

  const save = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error("Name and phone are required");
      return;
    }
    setSaving(true);
    try {
      await updateProfile(form);
      toast.success("Profile saved");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const addSavedLocation = async () => {
    if (!newLabel.trim() || !newAddress.trim()) {
      toast.error("Enter a label and address");
      return;
    }
    setSavingLoc(true);
    try {
      await saveLocation({
        label: newLabel.trim(),
        address: newAddress.trim(),
        area: newArea,
        lat: newCoords.lat,
        lng: newCoords.lng,
        isDefault: newDefault,
      });
      setNewLabel("");
      setNewAddress("");
      setNewDefault(false);
      setNewCoords({ lat: null, lng: null, source: "manual" });
      toast.success("Address saved");
      loadLocations();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSavingLoc(false);
    }
  };

  const removeSavedLocation = async (id: string) => {
    try {
      await deleteSavedLocation(id);
      toast.success("Saved address removed");
      loadLocations();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const initials =
    form.name
      .split(" ")
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "RM";

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Account" title="Profile" description={state.profile.email} />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.6fr]">
        <div className="space-y-4">
          <div className="rounded-3xl bg-gradient-brand p-6 text-primary-foreground shadow-glow">
            <span className="grid size-16 place-items-center rounded-full bg-card font-display text-xl font-bold text-primary">
              {initials}
            </span>
            <p className="mt-4 font-display text-2xl font-semibold">{state.profile.name}</p>
            <p className="opacity-90">{state.profile.phone}</p>
            <p className="mt-1 text-sm opacity-80">
              {state.profile.address}, {state.profile.area}
            </p>
          </div>
          <StatCard label="Recycled" value={fmtKg(kg)} icon={Scale} />
          <StatCard label="Pickups" value={mine.length} icon={Truck} />
          <StatCard
            label="Member since"
            value={state.profile.memberSince ? fmtDate(state.profile.memberSince) : "—"}
            icon={Leaf}
          />
        </div>

        <div className="space-y-6">
          <Panel title="Personal details">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm font-medium">
                Name
                <input
                  className={inputCls}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>
              <label className="text-sm font-medium">
                Phone
                <input
                  className={inputCls}
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </label>
              <label className="text-sm font-medium md:col-span-2">
                Default pickup address
                <input
                  className={inputCls}
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </label>
              <label className="text-sm font-medium">
                Area
                <select
                  className={inputCls}
                  value={form.area}
                  onChange={(e) => setForm({ ...form, area: e.target.value })}
                >
                  {AREAS.map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium">
                Language
                <select
                  className={inputCls}
                  value={form.language}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      language: e.target.value as RemakeState["profile"]["language"],
                    })
                  }
                >
                  {["English", "Wolof", "Mandinka"].map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-5 flex items-center justify-between rounded-2xl border p-4">
              <div>
                <p className="font-semibold">SMS pickup alerts</p>
                <p className="text-sm text-muted-foreground">
                  Get a text when your collector is on the way.
                </p>
              </div>
              <Switch
                checked={form.smsAlerts}
                onCheckedChange={(v) => setForm({ ...form, smsAlerts: v })}
              />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setForm(state.profile)}>
                Cancel
              </Button>
              <Button onClick={save} disabled={saving}>
                Save changes
              </Button>
            </div>
          </Panel>

          <Panel
            title="Saved pickup addresses"
            description="Changing a saved or default address never moves historical pickups."
          >
            {locStatus === "loading" ? (
              <p className="text-sm text-muted-foreground">Loading saved addresses…</p>
            ) : locStatus === "unavailable" ? (
              <p className="text-sm text-muted-foreground">
                Saved addresses are not available right now.
              </p>
            ) : savedLocations.length === 0 ? (
              <p className="mb-4 text-sm text-muted-foreground">No saved addresses yet.</p>
            ) : (
              <ul className="mb-5 divide-y rounded-2xl border">
                {savedLocations.map((loc) => (
                  <li
                    key={loc.id}
                    className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 font-medium">
                        <Bookmark className="size-3.5 text-primary" />
                        {loc.label}
                        {loc.isDefault && <Badge variant="success">Default</Badge>}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {loc.address}, {loc.area}
                        {loc.lat != null && loc.lng != null
                          ? ` · ${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}`
                          : ""}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${loc.label}`}
                      onClick={() => removeSavedLocation(loc.id)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            <div className="space-y-4 rounded-2xl border bg-muted/20 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <MapPin className="size-4 text-primary" /> Add saved address
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-xs font-medium">
                  Label
                  <input
                    className={inputCls}
                    placeholder="Home, Shop…"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                  />
                </label>
                <label className="text-xs font-medium">
                  Area
                  <select
                    className={inputCls}
                    value={newArea}
                    onChange={(e) => setNewArea(e.target.value)}
                  >
                    {AREAS.map((a) => (
                      <option key={a}>{a}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-medium md:col-span-2">
                  Address
                  <input
                    className={inputCls}
                    placeholder="Street, compound or landmark"
                    value={newAddress}
                    onChange={(e) => setNewAddress(e.target.value)}
                  />
                </label>
              </div>

              <LocationPickerMap value={newCoords} onChange={setNewCoords} />

              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex cursor-pointer items-center gap-2 text-xs">
                  <Checkbox checked={newDefault} onCheckedChange={(v) => setNewDefault(!!v)} />
                  <span>Set as default</span>
                </label>
                <Button type="button" size="sm" onClick={addSavedLocation} disabled={savingLoc}>
                  {savingLoc ? <Loader2 className="animate-spin" /> : <Plus className="size-4" />}
                  Save address
                </Button>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
