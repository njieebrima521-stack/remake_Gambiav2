import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { MOBILE_NAV, roleFor, type NavItem } from "./nav";

/** Fixed mobile bottom bar (below md); mirrors the original Remake mobile design. */
export function BottomNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const searchObj = useRouterState({
    select: (s) => (s.location.search as Record<string, unknown>) ?? {},
  });
  const activeSection = typeof searchObj["section"] === "string" ? searchObj["section"] : undefined;
  const role = roleFor(path);
  const nav = MOBILE_NAV[role.key] ?? { items: role.items.slice(0, 4) };
  const isActive = (item: NavItem, idx: number) => {
    const pathMatches =
      item.to === role.home ? path === item.to || path === `${item.to}/` : path.startsWith(item.to);
    const sec = item.search?.["section"];
    return sec ? pathMatches && (activeSection ? activeSection === sec : idx === 0) : pathMatches;
  };

  const Item = ({ item, idx }: { item: NavItem; idx: number }) => {
    const on = isActive(item, idx);
    return (
      <Link
        to={item.to}
        search={item.search as never}
        activeOptions={{ exact: item.to === role.home }}
        className={cn(
          "flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
          on ? "text-primary" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <item.icon className="size-[22px]" strokeWidth={on ? 2.25 : 1.75} />
        <span>{item.label}</span>
      </Link>
    );
  };

  const half = Math.ceil(nav.items.length / 2);
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_-8px_var(--border)] md:hidden"
    >
      <div className="mx-auto flex max-w-lg items-stretch px-2">
        {nav.center ? (
          <>
            {nav.items.slice(0, half).map((i, idx) => (
              <Item key={`${i.to}-${i.label}`} item={i} idx={idx} />
            ))}
            <div className="flex w-20 shrink-0 justify-center">
              <Link
                to={nav.center.to}
                aria-label={nav.center.label}
                className={cn(
                  "-mt-6 grid size-16 place-items-center rounded-full bg-primary text-primary-foreground shadow-glow ring-4 ring-card transition-transform active:scale-95",
                  isActive(nav.center, -1) && "bg-primary-strong",
                )}
              >
                <nav.center.icon className="size-7" />
              </Link>
            </div>
            {nav.items.slice(half).map((i, idx) => (
              <Item key={`${i.to}-${i.label}`} item={i} idx={half + idx} />
            ))}
          </>
        ) : (
          nav.items.map((i, idx) => <Item key={`${i.to}-${i.label}`} item={i} idx={idx} />)
        )}
      </div>
    </nav>
  );
}
