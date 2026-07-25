"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getCallerRestaurantId } from "@/lib/api/restaurant";
import { getNextOrderStatus, advanceOrderStatus, type OrderStatus } from "@/lib/orders/status";
import { EmptyState } from "@/components/staff/empty-state";
import { Button } from "@/components/ui/button";

interface OrderRow {
  id: string;
  status: OrderStatus;
  created_at: string;
  table_id: string | null;
  customer_id: string | null;
  table: { table_number: number } | null;
  order_items: {
    id: string;
    qty: number;
    price_at_order: number;
    customization_notes: string | null;
    menu_item: { name: string } | null;
  }[];
}

const ORDERS_SELECT = `
  id, status, created_at, table_id, customer_id,
  table:tables(table_number),
  order_items(id, qty, price_at_order, customization_notes, menu_item:menu_items(name))
`;

export default function OrdersPage() {
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [customerNames, setCustomerNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [advancingId, setAdvancingId] = useState<string | null>(null);

  const loadOrders = useCallback(async (rid: string) => {
    const supabase = createClient();

    const { data, error: ordersError } = await supabase
      .from("orders")
      .select(ORDERS_SELECT)
      .eq("restaurant_id", rid)
      .order("created_at", { ascending: false });

    if (ordersError) {
      setError(ordersError.message);
      return;
    }

    const rows = (data ?? []) as unknown as OrderRow[];
    setOrders(rows);
    setError(null);

    const customerIds = Array.from(
      new Set(rows.map((o) => o.customer_id).filter((id): id is string => !!id))
    );
    if (customerIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", customerIds);

      setCustomerNames(
        Object.fromEntries(
          (profiles ?? []).map((p) => [p.id, p.full_name ?? "Unnamed customer"])
        )
      );
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const rid = await getCallerRestaurantId(supabase);
      if (!rid) {
        setError("Could not resolve the caller's restaurant");
        setLoading(false);
        return;
      }
      setRestaurantId(rid);
      await loadOrders(rid);
      setLoading(false);

      channel = supabase
        .channel(`orders-${rid}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "orders",
            filter: `restaurant_id=eq.${rid}`,
          },
          () => {
            void loadOrders(rid);
          }
        )
        .subscribe();
    })();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [loadOrders]);

  async function handleAdvance(order: OrderRow) {
    if (!restaurantId) return;
    setAdvancingId(order.id);
    try {
      const supabase = createClient();
      await advanceOrderStatus(supabase, order.id, order.status);
      // Realtime subscription (if enabled for this table) will refresh the
      // list; refetch here too so the UI updates even if it isn't.
      await loadOrders(restaurantId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to advance order");
    } finally {
      setAdvancingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading orders...</p>
      ) : orders.length === 0 ? (
        <EmptyState message="No orders yet." />
      ) : (
        <ul className="flex flex-col gap-3">
          {orders.map((order) => {
            const nextStatus = getNextOrderStatus(order.status);
            return (
              <li
                key={order.id}
                className="flex flex-col gap-2 rounded-lg border border-border p-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">
                      Table {order.table?.table_number ?? "—"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {order.customer_id
                        ? customerNames[order.customer_id] ?? "Loading customer..."
                        : "Guest"}
                    </span>
                  </div>
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium capitalize">
                    {order.status}
                  </span>
                </div>

                <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
                  {order.order_items.map((item) => (
                    <li key={item.id}>
                      {item.qty}x {item.menu_item?.name ?? "Unknown item"}
                      {item.customization_notes ? ` (${item.customization_notes})` : ""}
                    </li>
                  ))}
                </ul>

                {nextStatus && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={advancingId === order.id}
                    onClick={() => handleAdvance(order)}
                    className="self-start"
                  >
                    {advancingId === order.id
                      ? "Advancing..."
                      : `Advance to ${nextStatus}`}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
