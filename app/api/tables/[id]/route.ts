import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCallerRestaurantId } from "@/lib/api/restaurant";
import type { Database } from "@/types/database";

type TableStatus = Database["public"]["Enums"]["table_status"];

// Must match the table_status enum in supabase/migrations.
const TABLE_STATUSES: TableStatus[] = ["free", "occupied", "reserved"];

function isTableStatus(value: string): value is TableStatus {
  return (TABLE_STATUSES as string[]).includes(value);
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

  const { status } = body as Record<string, unknown>;

  if (typeof status !== "string" || !isTableStatus(status)) {
    return NextResponse.json(
      { error: `status must be one of: ${TABLE_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("tables")
    .update({ status })
    .eq("id", params.id)
    .eq("restaurant_id", restaurantId)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (!data) {
    return NextResponse.json({ error: "Table not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}
