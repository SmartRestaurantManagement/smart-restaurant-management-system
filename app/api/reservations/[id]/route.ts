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

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const restaurantId = await getCallerRestaurantId(supabase);
  if (!restaurantId) {
    return NextResponse.json(
      { error: "Could not resolve the caller's restaurant" },
      { status: 401 }
    );
  }

  const { data, error } = await supabase
    .from("reservations")
    .select("*")
    .eq("id", params.id)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    table_id,
    reserved_for,
    party_size,
    status,
  } = body as Record<string, unknown>;

  const update: Database["public"]["Tables"]["reservations"]["Update"] = {};

  if (customer_name !== undefined) {
    if (typeof customer_name !== "string" || customer_name.trim() === "") {
      return NextResponse.json(
        { error: "customer_name must be a non-empty string" },
        { status: 400 }
      );
    }
    update.customer_name = customer_name;
  }
  if (customer_phone !== undefined) {
    if (customer_phone !== null && typeof customer_phone !== "string") {
      return NextResponse.json(
        { error: "customer_phone must be a string or null" },
        { status: 400 }
      );
    }
    update.customer_phone = customer_phone;
  }
  if (customer_email !== undefined) {
    if (customer_email !== null && typeof customer_email !== "string") {
      return NextResponse.json(
        { error: "customer_email must be a string or null" },
        { status: 400 }
      );
    }
    update.customer_email = customer_email;
  }
  if (table_id !== undefined) {
    if (table_id !== null && typeof table_id !== "string") {
      return NextResponse.json(
        { error: "table_id must be a string or null" },
        { status: 400 }
      );
    }
    update.table_id = table_id;
  }
  if (reserved_for !== undefined) {
    if (
      typeof reserved_for !== "string" ||
      Number.isNaN(Date.parse(reserved_for))
    ) {
      return NextResponse.json(
        { error: "reserved_for must be a valid ISO timestamp" },
        { status: 400 }
      );
    }
    update.reserved_for = reserved_for;
  }
  if (party_size !== undefined) {
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
    update.party_size = party_size;
  }
  if (status !== undefined) {
    if (typeof status !== "string" || !isReservationStatus(status)) {
      return NextResponse.json(
        { error: `status must be one of: ${RESERVATION_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }
    update.status = status;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      { error: "No updatable fields provided" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("reservations")
    .update(update)
    .eq("id", params.id)
    .eq("restaurant_id", restaurantId)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (!data) {
    return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const restaurantId = await getCallerRestaurantId(supabase);
  if (!restaurantId) {
    return NextResponse.json(
      { error: "Could not resolve the caller's restaurant" },
      { status: 401 }
    );
  }

  const { data, error } = await supabase
    .from("reservations")
    .delete()
    .eq("id", params.id)
    .eq("restaurant_id", restaurantId)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (!data) {
    return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  }

  return NextResponse.json({ cancelled: data });
}
