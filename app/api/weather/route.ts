import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWeatherForRestaurant } from "@/lib/weather/cache";

// Mumbai — placeholder until restaurants have their own stored coordinates.
const DEFAULT_LATITUDE = 19.076;
const DEFAULT_LONGITUDE = 72.8777;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const latitude = Number(searchParams.get("lat") ?? DEFAULT_LATITUDE);
  const longitude = Number(searchParams.get("lon") ?? DEFAULT_LONGITUDE);

  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    return NextResponse.json(
      { error: "lat/lon must be numbers" },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const { data: restaurantId, error: restaurantError } = await supabase.rpc(
    "current_restaurant_id"
  );

  if (restaurantError || !restaurantId) {
    return NextResponse.json(
      { error: "Could not resolve the caller's restaurant" },
      { status: 401 }
    );
  }

  try {
    const weather = await getWeatherForRestaurant(
      supabase,
      restaurantId,
      latitude,
      longitude
    );
    return NextResponse.json(weather);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch weather",
      },
      { status: 502 }
    );
  }
}
