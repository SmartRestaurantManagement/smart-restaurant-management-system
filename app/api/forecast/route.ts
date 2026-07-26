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

  console.log(`[API Forecast] GET request received for restaurantId: ${restaurantId}, lat: ${lat}, lon: ${lon}`);

  try {
    // 1. Run the forecasting engine
    const forecasts = await forecastDemand(supabase, restaurantId, lat, lon);
    console.log(`[API Forecast] Engine successfully generated ${forecasts.length} forecasts.`);

    // 2. Fetch existing offers to avoid overwriting or deactivating active/approved ones
    const { data: existingOffers, error: existingError } = await supabase
      .from("offers")
      .select("*")
      .eq("restaurant_id", restaurantId);

    if (existingError) {
      console.error(`[API Forecast] Error fetching existing offers: ${existingError.message}`);
    }

    const existingOffersMap = new Map(existingOffers?.map(o => [o.menu_item_id, o]) || []);

    // 3. For any item with overstock risk, generate a draft Smart Offer (active: false)
    const draftOffersToInsert = [];
    const tomorrowEndOfDay = new Date();
    tomorrowEndOfDay.setDate(tomorrowEndOfDay.getDate() + 1);
    tomorrowEndOfDay.setHours(23, 59, 59, 999);

    for (const f of forecasts) {
      if (f.overstockRisk && f.suggestedDiscountPct > 0) {
        const existing = existingOffersMap.get(f.menuItemId);
        if (!existing) {
          console.log(`[API Forecast] Generating draft offer for ${f.name} (discount: ${f.suggestedDiscountPct}%)`);
          draftOffersToInsert.push({
            restaurant_id: restaurantId,
            menu_item_id: f.menuItemId,
            discount_pct: f.suggestedDiscountPct,
            floor_price: f.floorPrice,
            active: false, // Inactive by default: requires staff approval
            expires_at: tomorrowEndOfDay.toISOString(),
          });
        }
      }
    }

    if (draftOffersToInsert.length > 0) {
      const { error: offersError } = await supabase
        .from("offers")
        .insert(draftOffersToInsert);

      if (offersError) {
        console.error(`[API Forecast] Failed to insert draft smart offers: ${offersError.message}`);
      } else {
        console.log(`[API Forecast] Successfully inserted ${draftOffersToInsert.length} draft offers.`);
      }
    }

    return NextResponse.json(forecasts);
  } catch (error) {
    console.error("[API Forecast] Exception occurred in forecasting route:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to run forecasting" },
      { status: 500 }
    );
  }
}
