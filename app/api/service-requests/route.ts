import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCallerRestaurantId } from "@/lib/api/restaurant";
import type { Database } from "@/types/database";

type ServiceRequestType = Database["public"]["Enums"]["service_request_type"];

const SERVICE_REQUEST_TYPES: ServiceRequestType[] = ["water", "server", "bill"];

function isServiceRequestType(value: string): value is ServiceRequestType {
  return (SERVICE_REQUEST_TYPES as string[]).includes(value);
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
  const status = searchParams.get("status");

  let query = supabase
    .from("service_requests")
    .select("*, table:tables(table_number)")
    .eq("restaurant_id", restaurantId)
    .order("requested_at", { ascending: false });

  if (status) {
    query = query.eq("status", status as any);
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

  const { table_id, type } = body as Record<string, unknown>;

  if (typeof table_id !== "string" || table_id.trim() === "") {
    return NextResponse.json(
      { error: "table_id is required" },
      { status: 400 }
    );
  }

  if (typeof type !== "string" || !isServiceRequestType(type)) {
    return NextResponse.json(
      { error: `type must be one of: ${SERVICE_REQUEST_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  // Insert the request
  const { data, error } = await supabase
    .from("service_requests")
    .insert({
      restaurant_id: restaurantId,
      table_id,
      type,
      status: "pending" as const,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data, { status: 201 });
}
