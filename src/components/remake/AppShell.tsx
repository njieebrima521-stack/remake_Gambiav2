import { Link, useRouterState } from "@tanstack/react-router";
import { Bell, ChevronsLeft, ChevronsRight, Cloud, Coins, Search } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { BottomNav } from "./BottomNav";
import { personaFor, roleFor } from "./nav";
import { AccountMenu } from "./AccountMenu";
import { NotificationsMenu } from "./NotificationsMenu";
import { Logo } from "./Logo";
import { useRemake } from "@/lib/remake/store";
import { fmtNum } from "@/lib/remake/format";

function NavList({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const searchObj = useRouterState({
    select: (s) => (s.location.search as Record<string, unknown>) ?? {},
  });
  const activeSection = typeof searchObj["section"] === "string" ? searchObj["section"] : undefined;
  const role = roleFor(path);
  const isPathActive = (to: string) =>
    to === role.home ? path === to || path === `${to}/` : path.startsWith(to);
  return (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
      <div>
        {!collapsed && (
          <p className="mb-2 px-3 max-lg:hidden text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {role.label}
          </p>
        )}
        <ul className="space-y-1">
          {role.items.map((item, idx) => {
            const pathMatches =
              isPathActive(item.to) &&
              !role.items.some(
                (o) => o.to !== item.to && o.to.length > item.to.length && path.startsWith(o.to),
              );
            const itemSection = item.search?.["section"];
            const active = itemSection
              ? pathMatches && (activeSection ? activeSection === itemSection : idx === 0)
              : pathMatches;
            return (
              <li key={`${item.to}-${itemSection ?? item.label}`}>
                <Link
                  to={item.to}
                  search={item.search as never}
                  onClick={onNavigate}
                  title={item.label}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                    collapsed ? "justify-center px-0" : "max-lg:justify-center max-lg:px-0",
                    active
                      ? "bg-primary text-primary-foreground shadow-glow"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )}
                >
                  <item.icon className="size-[18px] shrink-0" />
                  {!collapsed && <span className="truncate max-lg:hidden">{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { state } = useRemake();
  const persona = personaFor(path, state.profile.name, state.me?.orgs);
  const isResident = path.startsWith("/resident") && !!state.me?.roles.includes("resident");
  const unread = state.notifications.filter((n) => !n.read).length;

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 md:flex",
          collapsed ? "w-[76px]" : "w-[76px] lg:w-[264px]",
        )}
      >
        <div
          className={cn(
            "flex h-16 items-center border-b border-sidebar-border px-5",
            collapsed ? "justify-center px-0" : "max-lg:justify-center max-lg:px-0",
          )}
        >
          <Link to="/" aria-label="Remake home">
            <span className="max-lg:hidden">
              <Logo compact={collapsed} />
            </span>
            <span className="lg:hidden">
              <Logo compact />
            </span>
          </Link>
        </div>
        <NavList collapsed={collapsed} />
        <div className="space-y-2 border-t border-sidebar-border p-3">
          {!collapsed && (
            <div className="rounded-xl bg-mint p-3 max-lg:hidden text-xs text-mint-foreground">
              <p className="flex items-center gap-1.5 font-semibold">
                <Cloud className="size-3.5" /> Live data
              </p>
              <p className="mt-1 opacity-80">
                Everything you do here is saved to your Remake account.
              </p>
            </div>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className={cn(
              "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-muted max-lg:hidden",
              collapsed && "justify-center px-0",
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronsRight className="size-4" />
            ) : (
              <>
                <ChevronsLeft className="size-4" /> Collapse
              </>
            )}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 min-w-0 items-center gap-2 border-b bg-card/85 px-4 backdrop-blur md:px-8">
          <Link to="/" aria-label="Remake home" className="md:hidden">
            <Logo compact />
          </Link>
          <div className="relative hidden max-w-sm flex-1 md:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              placeholder="Search pickups, batches, materials…"
              className="h-10 w-full rounded-xl border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              onKeyDown={(e) => {
                if (e.key === "Enter") toast("Search is coming soon.");
              }}
            />
          </div>
          <div className="ml-auto flex items-center gap-2 md:gap-3">
            {isResident && (
              <Link
                to="/resident/rewards"
                className="flex items-center gap-2 rounded-full bg-ink px-3 py-1.5 text-sm font-semibold text-ink-foreground"
              >
                <Coins className="size-4 text-primary" />
                <span className="tabular">{fmtNum(state.wallet.available)}</span>
              </Link>
            )}
            {isResident ? (
              <Link
                to="/resident/notifications"
                className="relative grid size-10 place-items-center rounded-full border bg-card hover:bg-muted"
                aria-label="Notifications"
              >
                <Bell className="size-[18px]" />
                {unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                    {unread}
                  </span>
                )}
              </Link>
            ) : (
              <NotificationsMenu unread={unread} />
            )}
            <AccountMenu name={persona.name} />
          </div>
        </header>
        <main className="mx-auto w-full min-w-0 max-w-[1280px] flex-1 px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-5 md:px-8 md:py-8">
          {children}
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
