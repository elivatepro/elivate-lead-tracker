import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Untyped service-role client for server jobs (cron, public unsubscribe).
// The hand-maintained Database type doesn't model relationships, so typed
// queries against it resolve to `never`; the cron routes already avoid it.
// Bypasses RLS: callers must scope every query by workspace_id themselves.
export function createServiceClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
