import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { fetchWeather } from "../weather/open-meteo";

export interface DemandForecast {
  menuItemId: string;
  name: string;
  price: number;
  remainingStock: number | null;
  predictedDemand: number;
  overstockRisk: boolean;
  understockRisk: boolean;
  suggestedDiscountPct: number; // 0 if no risk
  floorPrice: number;
  costPerPortion: number;
}

// Map menu item names and categories to comfort food vs. cold items classifications
function classifyItemType(name: string, categoryName?: string): "comfort" | "cold" | "neutral" {
  const nameLower = name.toLowerCase();
  const catLower = categoryName?.toLowerCase() || "";

  if (
    nameLower.includes("ice cream") ||
    nameLower.includes("lassi") ||
    nameLower.includes("shake") ||
    nameLower.includes("cold") ||
    nameLower.includes("kulfi") ||
    catLower.includes("dessert") ||
    catLower.includes("beverage")
  ) {
    // Shakes and ice creams are cold, but double check we don't catch hot tea/coffee
    if (nameLower.includes("tea") || nameLower.includes("coffee") || nameLower.includes("hot")) {
      return "comfort";
    }
    return "cold";
  }

  if (
    nameLower.includes("soup") ||
    nameLower.includes("naan") ||
    nameLower.includes("tea") ||
    nameLower.includes("coffee") ||
    nameLower.includes("kadhai") ||
    nameLower.includes("masala") ||
    nameLower.includes("tikka") ||
    nameLower.includes("paneer") ||
    catLower.includes("mains") ||
    catLower.includes("starter")
  ) {
    return "comfort";
  }

  return "neutral";
}

/**
 * Performs next-day demand forecasting for all menu items in a restaurant.
 * Uses historical order items, day-of-week patterns, and live weather signals.
 */
export async function forecastDemand(
  supabase: SupabaseClient<Database>,
  restaurantId: string,
  lat: number = 19.076,
  lon: number = 72.8777
): Promise<DemandForecast[]> {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  // 1. Fetch weather forecast for tomorrow
  let isRainy = false;
  let isHot = false;
  let isCold = false;

  try {
    const weather = await fetchWeather(lat, lon);
    const tomorrowWeather = weather.forecast[1]; // Index 1 is tomorrow
    if (tomorrowWeather) {
      const cond = tomorrowWeather.condition.toLowerCase();
      isRainy = cond.includes("rain") || cond.includes("drizzle") || cond.includes("shower") || cond.includes("thunderstorm");
      isHot = tomorrowWeather.tempMaxC > 30;
      isCold = tomorrowWeather.tempMinC < 20;
    }
  } catch (err) {
    console.warn("Could not fetch live weather for forecast, running with neutral weather conditions:", err);
  }

  // 2. Fetch all menu items and their margins
  const { data: menuItems, error: menuError } = await supabase
    .from("menu_items")
    .select("*, category:menu_categories(name)")
    .eq("restaurant_id", restaurantId);

  if (menuError || !menuItems) {
    throw new Error(`Failed to fetch menu items: ${menuError?.message}`);
  }

  // 3. Fetch item cost details from the database view
  const { data: costItems } = await supabase
    .from("menu_item_costs" as any)
    .select("*")
    .eq("restaurant_id", restaurantId);

  const costMap = new Map<string, { cost_per_portion: number; margin_per_portion: number }>();
  if (costItems) {
    const typedCostItems = costItems as unknown as any[];
    for (const item of typedCostItems) {
      costMap.set(item.menu_item_id, {
        cost_per_portion: Number(item.cost_per_portion || 0),
        margin_per_portion: Number(item.margin_per_portion || 0),
      });
    }
  }

  // 4. Fetch historical order item quantities to build baseline statistics
  // Calculate 7-day moving average of quantity sold, weighted by day-of-week.
  const fortyNineDaysAgo = new Date(tomorrow);
  fortyNineDaysAgo.setDate(fortyNineDaysAgo.getDate() - 50); // 50 days window to capture all 7 weeks
  const fortyNineDaysAgoStr = fortyNineDaysAgo.toISOString();

  const { data: orderHistory, error: historyError } = await supabase
    .from("order_items")
    .select("menu_item_id, qty, created_at")
    .eq("restaurant_id", restaurantId)
    .gte("created_at", fortyNineDaysAgoStr);

  const getLocalDateString = (d: Date) => d.toISOString().slice(0, 10);
  const targetDates = Array.from({ length: 7 }, (_, idx) => {
    const d = new Date(tomorrow);
    d.setDate(d.getDate() - 7 * (idx + 1));
    return getLocalDateString(d);
  });

  const weeklySalesMap = new Map<string, number[]>();

  if (!historyError && orderHistory) {
    for (const item of orderHistory) {
      const itemDateStr = new Date(item.created_at).toISOString().slice(0, 10);
      const weekIdx = targetDates.indexOf(itemDateStr);
      if (weekIdx !== -1) {
        const qtys = weeklySalesMap.get(item.menu_item_id) || Array(7).fill(0);
        qtys[weekIdx] += item.qty;
        weeklySalesMap.set(item.menu_item_id, qtys);
      }
    }
  }

  // Recency weights: Week 1 (most recent, 30%) down to Week 7 (oldest, 5%)
  const recencyWeights = [0.30, 0.20, 0.15, 0.12, 0.10, 0.08, 0.05];
  const forecasts: DemandForecast[] = [];

  for (const item of menuItems) {
    // A. Baseline demand (7-day weighted average on this day-of-week)
    const weeklySales = weeklySalesMap.get(item.id) || Array(7).fill(0);
    const totalSales = weeklySales.reduce((a, b) => a + b, 0);
    let baselineDemand = 5.0; // default baseline if no history at all

    if (totalSales > 0) {
      baselineDemand = weeklySales.reduce((sum, qty, idx) => sum + qty * recencyWeights[idx], 0);
      baselineDemand = Math.max(1.0, baselineDemand);
    } else {
      // Fallback: check if there's any sales in the last 50 days overall
      const itemTotalHistory = orderHistory
        ? orderHistory.filter(h => h.menu_item_id === item.id).reduce((sum, h) => sum + h.qty, 0)
        : 0;
      if (itemTotalHistory > 0) {
        baselineDemand = Math.max(1.0, itemTotalHistory / 50);
      }
    }

    // B. Apply Weather Adjustments (Transparent Rules)
    const itemType = classifyItemType(item.name, item.category?.name);
    let weatherMultiplier = 1.0;

    if (isRainy) {
      // Rain/low temp -> dine-in footfall down 15%, comfort food up 20%, cold items down 30%
      if (itemType === "comfort") {
        weatherMultiplier = 1.20;
      } else if (itemType === "cold") {
        weatherMultiplier = 0.70;
      }
      weatherMultiplier *= 0.85; // general footfall drop
    } else if (isHot) {
      // Hot days (>30°C): cold items up 25%, hot comfort down 15%
      if (itemType === "cold") {
        weatherMultiplier = 1.25;
      } else if (itemType === "comfort") {
        weatherMultiplier = 0.85;
      }
    } else if (isCold) {
      // Cold days (<20°C): hot comfort up 20%, cold items down 20%
      if (itemType === "comfort") {
        weatherMultiplier = 1.20;
      } else if (itemType === "cold") {
        weatherMultiplier = 0.80;
      }
    }

    const predictedDemand = Math.max(1, Math.round(baselineDemand * weatherMultiplier * 10) / 10);

    // C. Calculate Overstock/Understock Risks and Smart Offers
    const stock = item.remaining_stock;
    let overstockRisk = false;
    let understockRisk = false;
    let suggestedDiscountPct = 0;
    let floorPrice = Number(item.price);
    const costs = costMap.get(item.id) || { cost_per_portion: Number(item.price) * 0.4, margin_per_portion: Number(item.price) * 0.6 };

    if (stock !== null) {
      if (stock > predictedDemand) {
        overstockRisk = true;
        // Calculate a suggested discount to clear stock, capped so we sell at cost plus a 10% margin
        const costLimit = costs.cost_per_portion * 1.1; // Cost + 10% margin floor
        floorPrice = Math.max(costLimit, Number(item.price) * 0.5); // Never discount below 50%
        
        const potentialDiscount = ((Number(item.price) - floorPrice) / Number(item.price)) * 100;
        // Offer discount relative to the excess stock size
        const excessRatio = (stock - predictedDemand) / stock;
        suggestedDiscountPct = Math.min(Math.round(excessRatio * 50), Math.round(potentialDiscount));
        // Suggested discount should be at least 10% to be attractive
        if (suggestedDiscountPct < 10) {
          suggestedDiscountPct = 10;
          floorPrice = Number(item.price) * 0.9;
        }
      } else if (stock < predictedDemand) {
        understockRisk = true;
      }
    }

    forecasts.push({
      menuItemId: item.id,
      name: item.name,
      price: Number(item.price),
      remainingStock: stock,
      predictedDemand,
      overstockRisk,
      understockRisk,
      suggestedDiscountPct,
      floorPrice: Math.round(floorPrice * 100) / 100,
      costPerPortion: costs.cost_per_portion,
    });

    // 5. Cache the predicted demand in the forecast_cache table
    try {
      await supabase.from("forecast_cache").upsert({
        restaurant_id: restaurantId,
        menu_item_id: item.id,
        forecast_date: tomorrowStr,
        predicted_demand: predictedDemand,
      }, { onConflict: "restaurant_id,menu_item_id,forecast_date" });
    } catch (e) {
      console.warn(`Could not cache forecast for menu item ${item.name}:`, e);
    }
  }

  return forecasts;
}
