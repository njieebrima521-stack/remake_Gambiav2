import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, Check, ChevronRight, Search, Truck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel } from "@/components/remake/ui";
import { GUIDE_CATEGORIES } from "@/lib/remake/data";
import { useRemake } from "@/lib/remake/store";

type GuideSearch = {
  category?: string | undefined;
  q?: string | undefined;
};

export const Route = createFileRoute("/_authenticated/resident/guide")({
  validateSearch: (s: Record<string, unknown>): GuideSearch => ({
    category: typeof s["category"] === "string" && s["category"] ? s["category"] : undefined,
    q: typeof s["q"] === "string" ? s["q"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Recycling Guide — Remake" },
      {
        name: "description",
        content:
          "What Remake accepts, what it doesn't, and how to prepare each material in The Gambia.",
      },
      { property: "og:title", content: "Recycling Guide — Remake" },
      {
        property: "og:description",
        content: "Learn how to sort plastics, metals, glass, paper, e-waste and organics.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GuidePage,
});

function GuidePage() {
  const { state } = useRemake();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/resident/guide" });
  const q = search.q ?? "";
  const selected = search.category
    ? GUIDE_CATEGORIES.find((c) => c.id === search.category)
    : undefined;

  const setQuery = (nextQ: string) => {
    navigate({
      search: {
        category: search.category,
        q: nextQ || undefined,
      },
      replace: true,
    });
  };

  if (selected) {
    const rate = state.rates[selected.parent];
    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2"
          onClick={() => navigate({ search: { q: search.q } })}
        >
          <ArrowLeft /> All categories
        </Button>

        <Panel>
          <div className="flex flex-col gap-6 md:flex-row">
            <img
              src={selected.image}
              alt={selected.name}
              className="h-44 w-full rounded-2xl object-cover md:w-64"
            />
            <div className="flex-1">
              <h1 className="font-display text-2xl font-semibold">{selected.name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{selected.summary}</p>
              <p className="mt-4 inline-flex rounded-full bg-ink px-3 py-1 text-sm font-semibold text-ink-foreground">
                {rate?.active
                  ? `${rate.pointsPerKg} Green Coins per verified kg`
                  : "Collection paused"}
              </p>
              <div className="mt-5">
                <Button asChild>
                  <Link
                    to="/resident/pickups"
                    search={{
                      tab: "book",
                      material: selected.parent,
                      types: selected.materialType,
                    }}
                  >
                    <Truck /> Book Pickup
                  </Link>
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-mint p-4 text-mint-foreground">
              <p className="mb-2 font-semibold">Accepted</p>
              <ul className="space-y-1.5 text-sm">
                {selected.accepted.map((a) => (
                  <li key={a} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0" />
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl bg-danger-soft p-4 text-destructive">
              <p className="mb-2 font-semibold">Not accepted</p>
              <ul className="space-y-1.5 text-sm">
                {selected.notAccepted.map((a) => (
                  <li key={a} className="flex gap-2">
                    <X className="mt-0.5 size-4 shrink-0" />
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border p-4">
              <p className="mb-2 font-semibold">Preparation</p>
              <ol className="list-decimal space-y-1.5 pl-4 text-sm text-muted-foreground">
                {selected.prep.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ol>
            </div>
          </div>

          {selected.warnings.length > 0 && (
            <div className="mt-4 flex items-start gap-3 rounded-2xl bg-warning-soft p-4 text-sm text-warning">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <ul className="space-y-1">
                {selected.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </Panel>
      </div>
    );
  }

  const list = GUIDE_CATEGORIES.filter((m) => {
    if (!q.trim()) return true;
    const hay =
      `${m.name} ${m.summary} ${m.accepted.join(" ")} ${m.notAccepted.join(" ")}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });

  return (
    <div>
      <PageHeader
        eyebrow="Resident"
        title="Recycling guide"
        description="Select a category to inspect accepted items, preparation steps and verified rates."
      />

      <div className="relative mb-6 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search PET, cans, cardboard, phones…"
          className="h-11 w-full rounded-xl border bg-card pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          No category matches "{q}".
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((x) => {
            const rate = state.rates[x.parent];
            return (
              <button
                key={x.id}
                type="button"
                onClick={() => navigate({ search: { category: x.id, q: q || undefined } })}
                className="flex items-center gap-3.5 rounded-2xl border bg-card p-3.5 text-left transition hover:border-primary/40 hover:shadow-card"
              >
                <img
                  src={x.image}
                  alt=""
                  className="size-14 shrink-0 rounded-xl object-cover"
                  loading="lazy"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-display font-semibold">{x.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{x.summary}</p>
                  <p className="mt-1 text-xs font-semibold text-primary">
                    {rate?.active ? `${rate.pointsPerKg}/kg` : "Paused"}
                  </p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
