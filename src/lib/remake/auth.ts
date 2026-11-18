import { supabase } from "@/integrations/supabase/client";
import { roleByKey } from "@/components/remake/nav";
import type { AppRole } from "./types";

const ORDER: AppRole[] = ["resident", "business", "collector", "hub", "processor", "admin"];

/** Where a signed-in user should land: their sign-up workspace if granted, else their first role. */
export async function homeForCurrentUser(): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return "/auth";
  const [{ data: roles }, { data: prof }, { data: reqs }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", u.user.id),
    supabase.from("profiles").select("account_type").eq("id", u.user.id).maybeSingle(),
    supabase.from("role_requests").select("role").eq("user_id", u.user.id).eq("status", "pending"),
  ]);
  const have = new Set((roles ?? []).map((r) => r.role as AppRole));
  const preferred = prof?.account_type as AppRole | undefined;
  if (preferred && have.has(preferred)) return roleByKey(preferred).home;
  const first = ORDER.find((r) => have.has(r));
  if (first) return roleByKey(first).home;
  const pending = reqs?.[0]?.role as AppRole | undefined;
  return pending ? roleByKey(pending).home : "/resident/profile";
}

/** Only same-site paths are allowed as a post-login destination. */
export function safeRedirect(path: unknown): string | null {
  return typeof path === "string" && path.startsWith("/") && !path.startsWith("//") ? path : null;
}
