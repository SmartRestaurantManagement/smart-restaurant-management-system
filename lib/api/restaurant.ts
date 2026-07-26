import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/** Resolves the authenticated caller's restaurant_id via the current_restaurant_id() RPC, with fallback to first restaurant. */
export async function getCallerRestaurantId(
  supabase: SupabaseClient<Database>
): Promise<string | null> {
  const { data, error } = await supabase.rpc("current_restaurant_id");
  if (!error && data) return data;
  
  // Anonymous/dev mode fallback: fetch the first restaurant in the database
  const { data: firstRest } = await supabase
    .from("restaurants")
    .select("id")
    .limit(1)
    .maybeSingle();
    
  return firstRest?.id || null;
}
