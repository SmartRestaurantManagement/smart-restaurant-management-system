import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCallerRestaurantId } from "@/lib/api/restaurant";

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
    .from("bills")
    .select("*")
    .eq("id", params.id)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Bill not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}
