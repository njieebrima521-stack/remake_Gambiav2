import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Building2,
  Coins,
  Factory,
  Gift,
  Home,
  Route as RouteIcon,
  ScanLine,
  ShieldCheck,
  Truck,
  Warehouse,
  Scale,
  Boxes,
} from "lucide-react";
import heroImg from "@/assets/hero-beach.jpg";
import { Logo } from "@/components/remake/Logo";
import { Button } from "@/components/ui/button";
import { roleByKey } from "@/components/remake/nav";
import { useRemake } from "@/lib/remake/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Remake — Recycle, track and earn Green Coins in The Gambia" },
      {
        name: "description",
        content:
          "Explore Remake's recycling platform: residents, businesses, collectors, hubs, processors and admins working together across The Gambia.",
      },
      { property: "og:title", content: "Remake — Recycle, track and earn Green Coins" },
      {
        property: "og:description",
        content:
          "One platform connecting households, collectors, recycling hubs and processors in The Gambia.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const ROLES = [
  {
    to: "/resident",
    title: "Resident",
    text: "Scan waste, book pickups and earn Green Coins.",
    icon: Home,
    person: "Ebrima Njie · Kanifing",
  },
  {
    to: "/business",
    title: "Business",
    text: "Recurring collections, Green Score and impact reports.",
    icon: Building2,
    person: "Kololi Sands Hotel",
  },
  {
    to: "/collector",
    title: "Collector",
    text: "Routes, QR check-in, weighing, receipts and earnings.",
    icon: RouteIcon,
    person: "Lamin Ceesay",
  },
  {
    to: "/hub",
    title: "Recycling Hub",
    text: "Receive collections, build batches, hand over.",
    icon: Warehouse,
    person: "Kanifing Recycling Hub",
  },
  {
    to: "/processor",
    title: "Processor",
    text: "Inspect batches, record accepted and rejected weight.",
    icon: Factory,
    person: "Gambia Polymer Works",
  },
  {
    to: "/admin",
    title: "Admin",
    text: "Users, collections, materials, partners and rewards.",
    icon: ShieldCheck,
    person: "Remake Operations",
  },
] as const;

const FLOW = [
  { icon: ScanLine, label: "Scan" },
  { icon: Truck, label: "Book pickup" },
  { icon: Scale, label: "Weigh" },
  { icon: Boxes, label: "Batch" },
  { icon: Factory, label: "Verify" },
  { icon: Coins, label: "Points" },
  { icon: Gift, label: "Redeem" },
];

function Landing() {
  const { state } = useRemake();
  const home = state.me?.roles[0] ? roleByKey(state.me.roles[0]).home : null;
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex h-20 max-w-[1280px] items-center justify-between gap-3 px-4 sm:px-6 md:px-10">
        <Logo />
        <div className="flex items-center gap-2 sm:gap-3">
          {home ? (
            <Button asChild variant="ink">
              <Link to={home}>
                Open<span className="hidden sm:inline">&nbsp;dashboard</span>
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ink">
                <Link to="/join">Enter demo</Link>
              </Button>
            </>
          )}
        </div>
      </header>

      <section className="mx-auto grid max-w-[1280px] items-center gap-12 px-6 pb-16 pt-6 md:px-10 lg:grid-cols-[1fr_1.1fr] lg:pt-10">
        <div>
          <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-mint px-3 py-1 text-xs font-semibold text-mint-foreground">
            🇬🇲 Built for The Gambia
          </p>
          <h1 className="text-[44px] font-semibold leading-[1.05] md:text-6xl">
            Welcome to <br />
            Re<span className="text-primary">make</span>
          </h1>
          <p className="mt-5 max-w-lg text-lg text-muted-foreground">
            Together we create a cleaner and greener environment by managing waste efficiently —
            from your doorstep to the recycler, rewarded with Green Coins.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="xl">
              <Link to={home ?? "/join"}>
                {home ? "Go to my dashboard" : "Enter the demo"} <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
        <div className="relative">
          <img
            src={heroImg}
            alt="Volunteers collecting plastic bottles on a Gambian beach at sunset"
            width={1600}
            height={912}
            className="aspect-[4/3] w-full rounded-[2rem] object-cover shadow-lift"
          />
          <div className="absolute -bottom-6 left-6 w-[260px] rounded-3xl bg-gradient-ink p-5 text-ink-foreground shadow-lift">
            <p className="text-xs text-ink-muted">Your Green Coins</p>
            <p className="mt-1 font-display text-3xl font-semibold tabular">2,450</p>
            <div className="mt-3 flex gap-2 text-xs">
              <span className="rounded-full bg-primary px-3 py-1 font-semibold text-primary-foreground">
                Redeem
              </span>
              <span className="rounded-full border border-ink-foreground/30 px-3 py-1">
                +90 pending
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1280px] px-6 py-12 md:px-10">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold">Choose a role to explore</h2>
            <p className="mt-1 text-muted-foreground">
              Each partner gets its own workspace. Switch between the ones on your account from the
              account menu.
            </p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ROLES.map((r) => (
            <Link
              key={r.to}
              to={r.to}
              className="group rounded-2xl border bg-card p-6 shadow-card transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lift"
            >
              <div className="flex items-start justify-between">
                <span className="grid size-11 place-items-center rounded-xl bg-mint text-mint-foreground group-hover:bg-primary group-hover:text-primary-foreground">
                  <r.icon className="size-5" />
                </span>
                <ArrowRight className="size-5 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{r.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{r.text}</p>
              <p className="mt-4 text-xs font-medium text-foreground/70">{r.person}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1280px] px-6 pb-20 pt-4 md:px-10">
        <div className="rounded-3xl bg-gradient-forest p-8 text-primary-foreground md:p-10">
          <h2 className="text-2xl font-semibold">One loop, every partner</h2>
          <p className="mt-1 max-w-xl opacity-85">
            Coins stay pending until the processor verifies the material — then they're ready to
            spend.
          </p>
          <ol className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {FLOW.map((f, i) => (
              <li key={f.label} className="rounded-2xl bg-ink-foreground/10 p-4 backdrop-blur">
                <span className="text-xs opacity-70">Step {i + 1}</span>
                <f.icon className="mt-2 size-6" />
                <p className="mt-2 font-semibold">{f.label}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  );
}
