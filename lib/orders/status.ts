import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type OrderStatus = Database["public"]["Enums"]["order_status"];
export type Order = Database["public"]["Tables"]["orders"]["Row"];

// Forward-only lifecycle. Must match the order_status enum in
// supabase/migrations. "cancelled" is reachable from any status but is not
// part of the forward sequence, so it's deliberately excluded here.
const ORDER_STATUS_SEQUENCE: OrderStatus[] = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "served",
  "completed",
];

/** Next status in the forward lifecycle, or null if `current` is terminal (completed/cancelled) or unrecognized. */
export function getNextOrderStatus(current: OrderStatus): OrderStatus | null {
  const index = ORDER_STATUS_SEQUENCE.indexOf(current);
  if (index === -1 || index === ORDER_STATUS_SEQUENCE.length - 1) return null;
  return ORDER_STATUS_SEQUENCE[index + 1];
}

/**
 * Advances an order to its next status. This is the single place order
 * status changes - the wait-time engine (Day 2) will read from whatever
 * per-status timestamp record this function produces, so all transitions
 * must go through here rather than ad-hoc .update() calls elsewhere.
 *
 * NOT YET WIRED: supabase/migrations has no per-status timestamp record
 * (no order_status_history table yet - team is adding one). Once it
 * exists, insert the history row here, right after the status update,
 * inside the same function - this stays the one place a transition is
 * recorded, nothing else needs to change.
 */
export async function advanceOrderStatus(
  supabase: SupabaseClient<Database>,
  orderId: string,
  currentStatus: OrderStatus
): Promise<Order> {
  const nextStatus = getNextOrderStatus(currentStatus);
  if (!nextStatus) {
    throw new Error(`Order ${orderId} is already in a terminal status: ${currentStatus}`);
  }

  const { data, error } = await supabase
    .from("orders")
    .update({ status: nextStatus })
    .eq("id", orderId)
    .eq("status", currentStatus) // guards against double-advancing a stale/racing read
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to advance order status: ${error.message}`);
  }

  // Insert status history row
  try {
    const { error: historyError } = await (supabase as any)
      .from("order_status_history")
      .insert({
        restaurant_id: data.restaurant_id,
        order_id: orderId,
        status: nextStatus,
      });

    if (historyError) {
      console.warn("Failed to write to order_status_history:", historyError.message);
    }
  } catch (err) {
    console.warn("Error inserting order status history:", err);
  }

  return data;
}
