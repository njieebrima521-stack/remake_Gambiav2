import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft,
  Building2,
  Factory,
  Gift,
  Landmark,
  LocateFixed,
  Recycle,
  Route as RouteIcon,
  ShieldCheck,
  Truck,
  UserRound,
  Warehouse,
} from "lucide-react";
import { roleByKey } from "@/components/remake/nav";
import { toast } from "sonner";
import hero from "@/assets/hero-beach.jpg";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/remake/Logo";
import { supabase } from "@/integrations/supabase/client";
import { AREAS } from "@/lib/remake/data";
import { errorMessage } from "@/lib/remake/logic";
import { getDevicePosition } from "@/lib/remake/services/locations";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/join")({
  head: () => ({
    meta: [
      { title: "Join Remake — Recycle and earn Green Coins" },
      {
        name: "description",
        content:
          "Sign up to Remake to book waste pickups and redeem Green Coins for rewards in The Gambia.",
      },
      { property: "og:title", content: "Join Remake" },
      { property: "og:description", content: "Together we create a cleaner and greener Gambia." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: JoinPage,
});

const SLIDES = [
  {
    icon: Recycle,
    title: "Welcome to Remake",
    text: "Together we create a cleaner and greener environment by managing waste efficiently.",
  },
  {
    icon: Truck,
    title: "Easy garbage handover",
    text: "Request a waste pickup from your home or drop off your waste at the nearest collection point.",
  },
  {
    icon: Gift,
    title: "Redeem points for rewards",
    text: "Collect Green Coins from each drop-off and redeem them for airtime, cash power and more.",
  },
];
const TYPES = [
  { key: "resident", label: "Resident", text: "Recycle at home, earn coins", icon: UserRound },
  { key: "business", label: "Business", text: "Recurring commercial pickups", icon: Building2 },
  { key: "collector", label: "Collector", text: "Run routes and weigh waste", icon: RouteIcon },
  { key: "institution", label: "Institution", text: "Hub, processor or admin", icon: Landmark },
] as const;
const INSTITUTIONS = [
  { key: "hub", label: "Recycling Hub", icon: Warehouse },
  { key: "processor", label: "Processor", icon: Factory },
  { key: "admin", label: "Admin", icon: ShieldCheck },
] as const;
const inputCls =
  "mt-1.5 h-12 w-full rounded-xl border bg-card px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

function JoinPage() {
  const [type, setType] = useState<string | null>(null);
  const [inst, setInst] = useState<string | null>(null);
  const navigate = useNavigate();
  const [i, setI] = useState(0);
  const [name, setName] = useState("");
  const [bizName, setBizName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loc, setLoc] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracyM: number } | null>(
    null,
  );
  const [locBusy, setLocBusy] = useState(false);
  const [area, setArea] = useState<string>(AREAS[0]!);
  const [busy, setBusy] = useState(false);
  const captureLocation = async () => {
    setLocBusy(true);
    try {
      const pos = await getDevicePosition();
      setCoords(pos);
      toast.success(`Coordinates captured (±${pos.accuracyM} m)`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setLocBusy(false);
    }
  };
  const s = SLIDES[i]!;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!type) {
      toast.error("Choose your account type");
      return;
    }
    if (type === "institution" && !inst) {
      toast.error("Choose your institution workspace");
      return;
    }
    if (name.trim().length < 2) {
      toast.error("Enter your name");
      return;
    }
    if (type === "business" && bizName.trim().length < 2) {
      toast.error("Enter your business name");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      toast.error("Enter a valid email address");
      return;
    }
    if (!/^\+?[0-9 ]{7,20}$/.test(phone.trim())) {
      toast.error("Enter a valid phone number");
      return;
    }
    const workspace = type === "institution" ? inst! : type;
    setBusy(true);
    // Demo mode: no password or email confirmation — the details create a guest account kept in this browser.
    await supabase.auth.signOut();
    const { error } = await supabase.auth.signInAnonymously({
      options: {
        data: {
          full_name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          address: loc.trim(),
          area,
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
          account_type: type,
          workspace: type === "institution" ? inst : null,
          business_name: bizName.trim() || null,
        },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Welcome, ${name.split(" ")[0]}!`);
    navigate({ to: roleByKey(workspace).home });
  };
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden overflow-hidden lg:block">
        <img
          src={hero}
          alt="Gambian beach with plastic waste"
          className="absolute inset-0 size-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-12 text-ink-foreground">
          <s.icon className="size-10 text-primary" />
          <h2 className="mt-4 font-display text-4xl font-semibold">{s.title}</h2>
          <p className="mt-2 max-w-md text-ink-muted">{s.text}</p>
          <div className="mt-6 flex items-center gap-4">
            <div className="flex flex-wrap gap-1.5">
              {SLIDES.map((_, k) => (
                <button
                  key={k}
                  onClick={() => setI(k)}
                  aria-label={`Slide ${k + 1}`}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    k === i ? "w-8 bg-primary" : "w-3 bg-ink-foreground/40",
                  )}
                />
              ))}
            </div>
            <Button variant="pill" size="sm" onClick={() => setI((i + 1) % SLIDES.length)}>
              {i === SLIDES.length - 1 ? "Start again" : "Next"}
            </Button>
          </div>
        </div>
      </section>
      <section className="flex flex-col px-6 py-8 md:px-16">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground">
            <ArrowLeft className="size-4" /> Back
          </Link>
        </div>
        <div className="mx-auto my-auto w-full max-w-md py-10">
          <Logo />
          <h1 className="mt-8 font-display text-3xl font-semibold">Join with Remake</h1>
          <p className="mt-1 text-muted-foreground">
            Sign up now and start your journey to make The Gambia greener.
          </p>
          <form onSubmit={submit} className="mt-8 space-y-4">
            <fieldset>
              <legend className="text-sm font-medium">Account type</legend>
              <div className="mt-1.5 grid grid-cols-2 gap-2" role="radiogroup">
                {TYPES.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    role="radio"
                    aria-checked={type === t.key}
                    onClick={() => {
                      setType(t.key);
                      if (t.key !== "institution") setInst(null);
                    }}
                    className={cn(
                      "flex items-start gap-2.5 rounded-xl border bg-card p-3 text-left transition",
                      type === t.key
                        ? "border-primary bg-mint ring-2 ring-primary/20"
                        : "hover:border-primary/40",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-8 shrink-0 place-items-center rounded-lg",
                        type === t.key
                          ? "bg-primary text-primary-foreground"
                          : "bg-mint text-mint-foreground",
                      )}
                    >
                      <t.icon className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">{t.label}</span>
                      <span className="block text-xs text-muted-foreground">{t.text}</span>
                    </span>
                  </button>
                ))}
              </div>
              {type === "institution" && (
                <div
                  className="mt-2 grid grid-cols-3 gap-2"
                  role="radiogroup"
                  aria-label="Institution workspace"
                >
                  {INSTITUTIONS.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      role="radio"
                      aria-checked={inst === t.key}
                      onClick={() => setInst(t.key)}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-xl border p-2.5 text-xs font-semibold transition",
                        inst === t.key
                          ? "border-primary bg-primary text-primary-foreground"
                          : "bg-card hover:border-primary/40",
                      )}
                    >
                      <t.icon className="size-4" />
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
            </fieldset>
            <label className="block text-sm font-medium">
              Name
              <input
                className={inputCls}
                autoComplete="name"
                placeholder="Ebrima Njie"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            {type === "business" && (
              <label className="block text-sm font-medium">
                Business name
                <input
                  className={inputCls}
                  placeholder="Kololi Sands Hotel"
                  value={bizName}
                  onChange={(e) => setBizName(e.target.value)}
                />
              </label>
            )}
            <label className="block text-sm font-medium">
              Email
              <input
                type="email"
                autoComplete="email"
                className={inputCls}
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="block text-sm font-medium">
              Phone
              <input
                className={inputCls}
                placeholder="+220 771 2345"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </label>
            <label className="block text-sm font-medium">
              Location
              <div className="relative">
                <input
                  className={inputCls}
                  placeholder="Your address"
                  value={loc}
                  onChange={(e) => setLoc(e.target.value)}
                />
                <button
                  type="button"
                  disabled={locBusy}
                  onClick={captureLocation}
                  className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded-lg bg-mint px-2.5 py-1.5 text-xs font-semibold text-mint-foreground disabled:opacity-60"
                >
                  <LocateFixed className="size-3.5" />{" "}
                  {locBusy ? "Locating…" : "Use precise location"}
                </button>
              </div>
              {coords && (
                <span className="mt-1 block text-xs text-muted-foreground">
                  GPS: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)} (±{coords.accuracyM} m)
                </span>
              )}
            </label>
            <label className="block text-sm font-medium">
              Area
              <select className={inputCls} value={area} onChange={(e) => setArea(e.target.value)}>
                {AREAS.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </label>
            <p className="rounded-xl bg-mint p-3 text-xs text-mint-foreground">
              Demo access — no password needed. Fill in your details and you go straight into your
              workspace.
            </p>
            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              Enter Remake
            </Button>
          </form>
        </div>
      </section>
    </div>
  );
}
