import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCallerRestaurantId } from "@/lib/api/restaurant";
import type { Database } from "@/types/database";

type BillSplitMethod = Database["public"]["Enums"]["bill_split_method"];

// Must match the bill_split_method enum in supabase/migrations.
const BILL_SPLIT_METHODS: BillSplitMethod[] = [
  "none",
  "equal",
  "by_item",
  "custom",
];

function isBillSplitMethod(value: string): value is BillSplitMethod {
  return (BILL_SPLIT_METHODS as string[]).includes(value);
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const restaurantId = await getCallerRestaurantId(supabase);
  if (!restaurantId) {
    return NextResponse.json(
      { error: "Could not resolve the caller's restaurant" },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("order_id");

  let query = supabase
    .from("bills")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false });

  if (orderId) {
    query = query.eq("order_id", orderId);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const restaurantId = await getCallerRestaurantId(supabase);
  if (!restaurantId) {
    return NextResponse.json(
      { error: "Could not resolve the caller's restaurant" },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { order_id, split_method, payment_reference } =
    body as Record<string, unknown>;

  if (typeof order_id !== "string" || order_id.trim() === "") {
    return NextResponse.json(
      { error: "order_id is required" },
      { status: 400 }
    );
  }
  if (
    split_method !== undefined &&
    (typeof split_method !== "string" || !isBillSplitMethod(split_method))
  ) {
    return NextResponse.json(
      { error: `split_method must be one of: ${BILL_SPLIT_METHODS.join(", ")}` },
      { status: 400 }
    );
  }
  if (
    payment_reference !== undefined &&
    payment_reference !== null &&
    typeof payment_reference !== "string"
  ) {
    return NextResponse.json(
      { error: "payment_reference must be a string or null" },
      { status: 400 }
    );
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id")
    .eq("id", order_id)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (orderError) {
    return NextResponse.json({ error: orderError.message }, { status: 500 });
  }
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const { data: orderItems, error: itemsError } = await supabase
    .from("order_items")
    .select("qty, price_at_order")
    .eq("order_id", order_id)
    .eq("restaurant_id", restaurantId);

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }
  if (!orderItems || orderItems.length === 0) {
    return NextResponse.json(
      { error: "Order has no items to bill" },
      { status: 400 }
    );
  }

  const totalCents = orderItems.reduce(
    (sum, item) => sum + Math.round(item.price_at_order * item.qty * 100),
    0
  );
  const total = totalCents / 100;

  const { data, error } = await supabase
    .from("bills")
    .insert({
      restaurant_id: restaurantId,
      order_id,
      total,
      payment_reference: (payment_reference as string | null | undefined) ?? null,
      ...(split_method !== undefined
        ? { split_method: split_method as BillSplitMethod }
        : {}),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data, { status: 201 });
}
