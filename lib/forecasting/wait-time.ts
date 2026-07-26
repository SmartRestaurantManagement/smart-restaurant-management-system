import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const DEFAULT_PREP_TIME_MINS = 15;
const STAFF_CAPACITY = 3; // assumes 3 kitchen staff members

/**
 * Calculates the current estimated wait time (ETA) in minutes for a restaurant's new orders.
 * Formula: Rolling Average Prep Duration * (1 + Active Preparing Orders / Staff Capacity)
 */
export async function calculateEstimatedWaitTime(
  supabase: SupabaseClient<Database>,
  restaurantId: string
): Promise<{ etaMinutes: number; averagePrepMins: number; activeLoad: number }> {
  let averagePrepMins = DEFAULT_PREP_TIME_MINS;
  let activeLoad = 0;

  try {
    // 1. Fetch active orders in 'preparing' or 'confirmed' status
    const { count: activeCount, error: activeError } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId)
      .in("status", ["confirmed", "preparing"]);

    if (!activeError && activeCount !== null) {
      activeLoad = activeCount;
    }

    // 2. Fetch recent status changes from order_status_history to compute rolling average
    // We look for 'preparing' and 'ready' timestamps for the same orders in the last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: historyData, error: historyError } = await supabase
      .from("order_status_history")
      .select("order_id, status, created_at")
      .eq("restaurant_id", restaurantId)
      .in("status", ["preparing", "ready"])
      .gte("created_at", oneDayAgo)
      .order("created_at", { ascending: true });

    if (!historyError && historyData && historyData.length > 0) {
      // Group timestamps by order_id
      const orderTimestamps = new Map<string, { preparing?: string; ready?: string }>();
      
      for (const row of historyData) {
        const entry = orderTimestamps.get(row.order_id) || {};
        if (row.status === "preparing") {
          entry.preparing = row.created_at;
        } else if (row.status === "ready") {
          entry.ready = row.created_at;
        }
        orderTimestamps.set(row.order_id, entry);
      }

      // Calculate durations in minutes
      const durationsMins: number[] = [];
      for (const [_, timestamps] of orderTimestamps.entries()) {
        if (timestamps.preparing && timestamps.ready) {
          const prepTimeMs = new Date(timestamps.ready).getTime() - new Date(timestamps.preparing).getTime();
          const prepTimeMins = prepTimeMs / (1000 * 60);
          if (prepTimeMins > 0 && prepTimeMins < 120) { // filter out outliers
            durationsMins.push(prepTimeMins);
          }
        }
      }

      if (durationsMins.length > 0) {
        const sum = durationsMins.reduce((a, b) => a + b, 0);
        averagePrepMins = sum / durationsMins.length;
      }
    }
  } catch (err) {
    console.warn("Wait-time engine failed to calculate from DB history, using fallbacks:", err);
  }

  // Calculate load factor: 1 + (activeLoad / staffCapacity)
  const loadFactor = 1 + activeLoad / STAFF_CAPACITY;
  const etaMinutes = Math.round(averagePrepMins * loadFactor);

  return {
    etaMinutes: Math.max(etaMinutes, 5), // Floor at 5 minutes
    averagePrepMins: Math.round(averagePrepMins * 10) / 10,
    activeLoad,
  };
}
