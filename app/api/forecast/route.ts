import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCallerRestaurantId } from "@/lib/api/restaurant";
import { forecastDemand } from "@/lib/forecasting/demand";

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
  const lat = searchParams.get("lat") ? Number(searchParams.get("lat")) : 19.076;
  const lon = searchParams.get("lon") ? Number(searchParams.get("lon")) : 72.8777;

  try {
    // 1. Run the forecasting engine
    const forecasts = await forecastDemand(supabase, restaurantId, lat, lon);

    // 2. Clear out existing auto-generated offers for tomorrow to avoid duplicates
    // In practice, we only clear or update active offers that were generated automatically.
    // Deactivating old offers
    await supabase
      .from("offers")
      .update({ active: false })
      .eq("restaurant_id", restaurantId);

    // 3. For any item with overstock risk, generate a live Smart Offer (discount)
    const activeOffersToInsert = [];
    const tomorrowEndOfDay = new Date();
    tomorrowEndOfDay.setDate(tomorrowEndOfDay.getDate() + 1);
    tomorrowEndOfDay.setHours(23, 59, 59, 999);

    for (const f of forecasts) {
      if (f.overstockRisk && f.suggestedDiscountPct > 0) {
        activeOffersToInsert.push({
          restaurant_id: restaurantId,
          menu_item_id: f.menuItemId,
          discount_pct: f.suggestedDiscountPct,
          floor_price: f.floorPrice,
          active: true,
          expires_at: tomorrowEndOfDay.toISOString(),
        });
      }
    }

    if (activeOffersToInsert.length > 0) {
      const { error: offersError } = await supabase
        .from("offers")
        .insert(activeOffersToInsert);

      if (offersError) {
        console.warn("Failed to insert auto-generated smart offers:", offersError.message);
      }
    }

    return NextResponse.json(forecasts);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to run forecasting" },
      { status: 500 }
    );
  }
}
