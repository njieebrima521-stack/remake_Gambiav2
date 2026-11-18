import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Untyped handle for service modules whose tables/functions are newer than the generated types.
 * Every write still goes through SECURITY DEFINER functions validated on the server.
 */
export const db = supabase as unknown as SupabaseClient;

export class ServiceError extends Error {
  /** True when the backend function does not exist yet (feature not connected). */
  notConnected: boolean;
  constructor(message: string, notConnected = false) {
    super(message);
    this.notConnected = notConnected;
  }
}

function toError(e: { message: string; code?: string } | null): ServiceError {
  const msg = e?.message ?? "Something went wrong";
  const missing =
    e?.code === "PGRST202" ||
    e?.code === "42883" ||
    e?.code === "PGRST205" ||
    e?.code === "42P01" ||
    /could not find the (function|table)/i.test(msg);
  return new ServiceError(
    missing ? "This feature isn't connected to the server yet." : msg,
    missing,
  );
}

/** Call a database function; throws ServiceError with the server's plain-language message. */
export async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await db.rpc(fn, args);
  if (error) throw toError(error);
  return data as T;
}

/** Run a select and throw on error. */
export async function rows<T>(
  q: PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>,
): Promise<T[]> {
  const { data, error } = await q;
  if (error) throw toError(error);
  return (data ?? []) as T[];
}
