import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { fetchWeather, type WeatherData } from "./open-meteo";

// How long a cached entry is trusted before we refetch, even if it's
// still "today". Weather doesn't change fast enough to warrant hitting
// the API on every request.
const STALE_AFTER_MS = 3 * 60 * 60 * 1000; // 3 hours

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function isStale(fetchedAt: string): boolean {
  return Date.now() - new Date(fetchedAt).getTime() > STALE_AFTER_MS;
}

/**
 * Returns today's weather for a restaurant, using weather_cache as a
 * read-through cache: a fresh cached row is returned as-is, a missing or
 * stale one triggers a live Open-Meteo fetch and is written back.
 *
 * Note: weather_cache's RLS write policy is staff/admin-only (see
 * supabase/migrations), so the cache write may be silently skipped for a
 * customer-scoped session. That's acceptable — the caller still gets the
 * freshly fetched data, it just may not persist for the next request.
 */
export async function getWeatherForRestaurant(
  supabase: SupabaseClient<Database>,
  restaurantId: string,
  latitude: number,
  longitude: number
): Promise<WeatherData> {
  const date = todayDateString();

  const { data: cached, error: readError } = await supabase
    .from("weather_cache")
    .select("forecast, fetched_at")
    .eq("restaurant_id", restaurantId)
    .eq("date", date)
    .maybeSingle();

  if (readError) {
    throw new Error(`Failed to read weather_cache: ${readError.message}`);
  }

  if (cached && !isStale(cached.fetched_at)) {
    return cached.forecast as unknown as WeatherData;
  }

  const fresh = await fetchWeather(latitude, longitude);

  const { error: writeError } = await supabase.from("weather_cache").upsert(
    {
      restaurant_id: restaurantId,
      date,
      forecast: fresh as unknown as Database["public"]["Tables"]["weather_cache"]["Insert"]["forecast"],
      fetched_at: new Date().toISOString(),
    },
    { onConflict: "restaurant_id,date" }
  );

  if (writeError) {
    console.warn(`weather_cache upsert skipped: ${writeError.message}`);
  }

  return fresh;
}
