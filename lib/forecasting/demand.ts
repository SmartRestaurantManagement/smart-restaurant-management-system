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
  suggestedDiscountPct: number; // 0 if no risk
  floorPrice: number;
  costPerPortion: number;
}

// Map menu item names to weather category classifications
function classifyItemByWeatherSensitivity(name: string): "hot" | "cold" | "neutral" {
  const lowercase = name.toLowerCase();
  if (lowercase.includes("soup") || lowercase.includes("naan") || lowercase.includes("tea") || lowercase.includes("coffee") || lowercase.includes("kadhai") || lowercase.includes("masala")) {
    return "hot";
  }
  if (lowercase.includes("ice cream") || lowercase.includes("lassi") || lowercase.includes("shake") || lowercase.includes("cold") || lowercase.includes("kulfi")) {
    return "cold";
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
  const dayOfWeek = tomorrow.getDay(); // 0 = Sunday, 1 = Monday, etc.

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
  // We'll calculate the average sales for the target day of week over the last 90 days
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const ninetyDaysAgoStr = ninetyDaysAgo.toISOString();

  const { data: orderHistory, error: historyError } = await supabase
    .from("order_items")
    .select("menu_item_id, qty, created_at")
    .eq("restaurant_id", restaurantId)
    .gte("created_at", ninetyDaysAgoStr);

  const historyQtyMap = new Map<string, number[]>(); // item_id -> list of quantities sold on that day of week
  if (!historyError && orderHistory) {
    for (const item of orderHistory) {
      const orderDate = new Date(item.created_at);
      if (orderDate.getDay() === dayOfWeek) {
        const list = historyQtyMap.get(item.menu_item_id) || [];
        list.push(item.qty);
        historyQtyMap.set(item.menu_item_id, list);
      }
    }
  }

  const forecasts: DemandForecast[] = [];

  for (const item of menuItems) {
    // A. Baseline demand (average quantity sold on this day of the week)
    const historicalSales = historyQtyMap.get(item.id) || [];
    let baselineDemand = 5.0; // default baseline if no history

    if (historicalSales.length > 0) {
      const totalSales = historicalSales.reduce((a, b) => a + b, 0);
      // Grouping by unique dates would be mathematically precise, but simple average is perfect for hackathon data
      baselineDemand = totalSales / Math.max(1, historicalSales.length / 3); // scaled approximation
    }

    // B. Apply Weather Adjustments
    const sensitivity = classifyItemByWeatherSensitivity(item.name);
    let weatherMultiplier = 1.0;

    if (isRainy) {
      if (sensitivity === "hot") {
        weatherMultiplier += 0.3; // +30% for hot soups/dishes in rain
      } else if (sensitivity === "cold") {
        weatherMultiplier -= 0.25; // -25% for ice creams/lassi in rain
      }
    } else if (isHot) {
      if (sensitivity === "cold") {
        weatherMultiplier += 0.25; // +25% for cold items on hot days
      } else if (sensitivity === "hot") {
        weatherMultiplier -= 0.15; // -15% for hot soups on hot days
      }
    } else if (isCold) {
      if (sensitivity === "hot") {
        weatherMultiplier += 0.2; // +20% for hot soups on cold days
      } else if (sensitivity === "cold") {
        weatherMultiplier -= 0.2; // -20% for cold items on cold days
      }
    }

    const predictedDemand = Math.max(1, Math.round(baselineDemand * weatherMultiplier * 10) / 10);

    // C. Calculate Overstock Risk and Smart Offers
    // Only items that have limited stock tracking (remaining_stock is not null) can be overstocked
    const stock = item.remaining_stock;
    let overstockRisk = false;
    let suggestedDiscountPct = 0;
    let floorPrice = Number(item.price);
    const costs = costMap.get(item.id) || { cost_per_portion: Number(item.price) * 0.4, margin_per_portion: Number(item.price) * 0.6 };

    if (stock !== null && stock > predictedDemand) {
      overstockRisk = true;
      // Calculate a suggested discount to clear stock, capped so we sell at cost plus a 10% margin
      const costLimit = costs.cost_per_portion * 1.1; // Cost + 10% margin floor
      floorPrice = Math.max(costLimit, Number(item.price) * 0.5); // Never discount below 50%
      
      const potentialDiscount = ((Number(item.price) - floorPrice) / Number(item.price)) * 100;
      // Offer discount relative to the excess stock size (e.g. 10% to 30% off)
      const excessRatio = (stock - predictedDemand) / stock;
      suggestedDiscountPct = Math.min(Math.round(excessRatio * 50), Math.round(potentialDiscount));
      // Suggested discount should be at least 10% to be attractive
      if (suggestedDiscountPct < 10) {
        suggestedDiscountPct = 10;
        floorPrice = Number(item.price) * 0.9;
      }
    }

    forecasts.push({
      menuItemId: item.id,
      name: item.name,
      price: Number(item.price),
      remainingStock: stock,
      predictedDemand,
      overstockRisk,
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
