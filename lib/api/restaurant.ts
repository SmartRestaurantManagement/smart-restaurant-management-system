import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/** Resolves the authenticated caller's restaurant_id via the current_restaurant_id() RPC. */
export async function getCallerRestaurantId(
  supabase: SupabaseClient<Database>
): Promise<string | null> {
  const { data, error } = await supabase.rpc("current_restaurant_id");
  if (error || !data) return null;
  return data;
}
