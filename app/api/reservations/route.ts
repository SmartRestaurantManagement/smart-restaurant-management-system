import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCallerRestaurantId } from "@/lib/api/restaurant";
import type { Database } from "@/types/database";

type ReservationStatus = Database["public"]["Enums"]["reservation_status"];

// Must match the reservation_status enum in supabase/migrations.
const RESERVATION_STATUSES: ReservationStatus[] = [
  "pending",
  "confirmed",
  "seated",
  "completed",
  "cancelled",
  "no_show",
];

function isReservationStatus(value: string): value is ReservationStatus {
  return (RESERVATION_STATUSES as string[]).includes(value);
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
  const date = searchParams.get("date");
  const status = searchParams.get("status");

  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "date must be in YYYY-MM-DD format" },
      { status: 400 }
    );
  }
  if (status && !isReservationStatus(status)) {
    return NextResponse.json(
      { error: `status must be one of: ${RESERVATION_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  let query = supabase
    .from("reservations")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("reserved_for", { ascending: true });

  if (date) {
    const start = `${date}T00:00:00.000Z`;
    const end = new Date(
      new Date(start).getTime() + 24 * 60 * 60 * 1000
    ).toISOString();
    query = query.gte("reserved_for", start).lt("reserved_for", end);
  }
  if (status && isReservationStatus(status)) {
    query = query.eq("status", status);
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

  const {
    customer_name,
    customer_phone,
    customer_email,
    customer_id,
    table_id,
    reserved_for,
    party_size,
    status,
  } = body as Record<string, unknown>;

  if (typeof customer_name !== "string" || customer_name.trim() === "") {
    return NextResponse.json(
      { error: "customer_name is required" },
      { status: 400 }
    );
  }
  if (
    typeof reserved_for !== "string" ||
    Number.isNaN(Date.parse(reserved_for))
  ) {
    return NextResponse.json(
      { error: "reserved_for must be a valid ISO timestamp" },
      { status: 400 }
    );
  }
  if (
    typeof party_size !== "number" ||
    !Number.isInteger(party_size) ||
    party_size <= 0
  ) {
    return NextResponse.json(
      { error: "party_size must be a positive integer" },
      { status: 400 }
    );
  }
  if (
    status !== undefined &&
    (typeof status !== "string" || !isReservationStatus(status))
  ) {
    return NextResponse.json(
      { error: `status must be one of: ${RESERVATION_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }
  if (
    customer_phone !== undefined &&
    customer_phone !== null &&
    typeof customer_phone !== "string"
  ) {
    return NextResponse.json(
      { error: "customer_phone must be a string or null" },
      { status: 400 }
    );
  }
  if (
    customer_email !== undefined &&
    customer_email !== null &&
    typeof customer_email !== "string"
  ) {
    return NextResponse.json(
      { error: "customer_email must be a string or null" },
      { status: 400 }
    );
  }
  if (table_id !== undefined && table_id !== null && typeof table_id !== "string") {
    return NextResponse.json(
      { error: "table_id must be a string or null" },
      { status: 400 }
    );
  }

  // customer_id defaults to the caller's own session; a customer can only
  // ever create a reservation for themselves anyway (enforced by RLS) - an
  // explicit customer_id (including null, for a staff-entered guest booking)
  // is honored as given.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const resolvedCustomerId =
    customer_id === undefined
      ? user?.id ?? null
      : customer_id === null || typeof customer_id === "string"
        ? customer_id
        : undefined;

  if (resolvedCustomerId === undefined) {
    return NextResponse.json(
      { error: "customer_id must be a string or null" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("reservations")
    .insert({
      restaurant_id: restaurantId,
      customer_name,
      customer_phone: (customer_phone as string | null | undefined) ?? null,
      customer_email: (customer_email as string | null | undefined) ?? null,
      customer_id: resolvedCustomerId,
      table_id: (table_id as string | null | undefined) ?? null,
      reserved_for,
      party_size,
      ...(status !== undefined ? { status: status as ReservationStatus } : {}),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data, { status: 201 });
}
