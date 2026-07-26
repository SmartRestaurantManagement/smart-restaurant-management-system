import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calculateEstimatedWaitTime } from "@/lib/forecasting/wait-time";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const restaurantId = searchParams.get("restaurant_id");

  if (!restaurantId) {
    return NextResponse.json(
      { error: "restaurant_id is required" },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  try {
    const etaData = await calculateEstimatedWaitTime(supabase, restaurantId);
    return NextResponse.json(etaData);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to calculate ETA" },
      { status: 500 }
    );
  }
}
