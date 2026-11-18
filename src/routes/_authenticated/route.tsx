import { Link, Outlet, createFileRoute, redirect, useRouterState } from "@tanstack/react-router";
import { Hourglass, Loader2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/remake/AppShell";
import { Button } from "@/components/ui/button";
import { roleByKey, roleFor } from "@/components/remake/nav";
import { useRemake } from "@/lib/remake/store";
import type { AppRole } from "@/lib/remake/types";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth", search: { redirect: location.pathname } });
  },
  component: DashboardLayout,
});

function DashboardLayout() {
  return (
    <AppShell>
      <WorkspaceGuard>
        <Outlet />
      </WorkspaceGuard>
    </AppShell>
  );
}

/** Shows a workspace only to accounts that actually hold its role (the backend enforces the same rule). */
function WorkspaceGuard({ children }: { children: React.ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { state } = useRemake();
  if (!state.loaded || !state.me) {
    return (
      <div className="grid min-h-[40vh] place-items-center text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }
  if (path.startsWith("/resident/profile")) return <>{children}</>;
  const role = roleFor(path);
  const key = role.key as AppRole;
  if (state.me.roles.includes(key)) return <>{children}</>;
  const pending = state.me.pendingRoles.includes(key);
  const own = state.me.roles[0];
  return (
    <div className="mx-auto max-w-lg rounded-2xl border bg-card p-8 text-center shadow-card">
      <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-mint text-mint-foreground">
        {pending ? <Hourglass className="size-6" /> : <Lock className="size-6" />}
      </span>
      <h1 className="mt-4 text-xl font-semibold">
        {pending
          ? `${role.label} access is awaiting approval`
          : `No access to the ${role.label} workspace`}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {pending
          ? "A Remake admin will review your request. You'll get a notification as soon as it's approved."
          : "This workspace isn't part of your account. Ask a Remake admin if you need it."}
      </p>
      {own ? (
        <Button asChild className="mt-6">
          <Link to={roleByKey(own).home}>Go to my {roleByKey(own).label} workspace</Link>
        </Button>
      ) : (
        <Button asChild variant="outline" className="mt-6">
          <Link to="/resident/profile">Open my profile</Link>
        </Button>
      )}
    </div>
  );
}
