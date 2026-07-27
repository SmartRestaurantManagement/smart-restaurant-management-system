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

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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
    if (nameLower.includes("tea") || nameLower.includes("coffee") || nameLower.includes("hot")) {
      return "comfort";
    }
    return "cold";
  }

  if (
    nameLower.includes("soup") ||
    nameLower.includes("naan") ||
    nameLower.includes("rotis") ||
    nameLower.includes("roti") ||
    nameLower.includes("tea") ||
    nameLower.includes("coffee") ||
    nameLower.includes("kadhai") ||
    nameLower.includes("masala") ||
    nameLower.includes("tikka") ||
    nameLower.includes("paneer") ||
    nameLower.includes("dal") ||
    catLower.includes("mains") ||
    catLower.includes("starter")
  ) {
    return "comfort";
  }

  return "neutral";
}

// Generate realistic fallback baseline based on item category and name hash
function getCategoryFallbackBaseline(name: string, categoryName?: string): number {
  const nameLower = name.toLowerCase();
  const catLower = categoryName?.toLowerCase() || "";

  if (nameLower.includes("naan") || nameLower.includes("roti") || catLower.includes("bread")) {
    return 38;
  }
  if (nameLower.includes("butter masala") || nameLower.includes("biryani") || nameLower.includes("dal makhani")) {
    return 24;
  }
  if (nameLower.includes("tikka") || nameLower.includes("paneer") || catLower.includes("starter")) {
    return 16;
  }
  if (nameLower.includes("pulao") || nameLower.includes("rice") || catLower.includes("mains")) {
    return 14;
  }
  if (nameLower.includes("lassi") || nameLower.includes("shake") || catLower.includes("beverage")) {
    return 18;
  }
  if (catLower.includes("dessert") || nameLower.includes("ice cream")) {
    return 12;
  }

  // Deterministic seed fallback based on string length & character sum
  const charSum = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return 10 + (charSum % 12);
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
  const targetDayOfWeek = tomorrow.getDay();
  const targetDayName = DAY_NAMES[targetDayOfWeek];

  console.log(`\n=================== FORECAST ENGINE RUN ===================`);
  console.log(`Forecast target date: ${tomorrowStr} (${targetDayName})`);
  console.log(`Restaurant ID: ${restaurantId}`);

  // 1. Fetch weather forecast for tomorrow
  let isRainy = false;
  let isHot = false;
  let isCold = false;
  let weatherCondText = "Clear";
  let weatherTempMax = 28;

  try {
    const weather = await fetchWeather(lat, lon);
    const tomorrowWeather = weather.forecast[1]; // Index 1 is tomorrow
    if (tomorrowWeather) {
      weatherCondText = tomorrowWeather.condition;
      weatherTempMax = tomorrowWeather.tempMaxC;
      const cond = tomorrowWeather.condition.toLowerCase();
      isRainy = cond.includes("rain") || cond.includes("drizzle") || cond.includes("shower") || cond.includes("thunderstorm");
      isHot = tomorrowWeather.tempMaxC > 30;
      isCold = tomorrowWeather.tempMinC < 20;
    }
  } catch (err) {
    console.warn("[Forecast Engine] Could not fetch live weather, using neutral weather:", err);
  }

  console.log(`Weather Signal: Condition = "${weatherCondText}", TempMax = ${weatherTempMax}°C, Rainy = ${isRainy}, Hot = ${isHot}, Cold = ${isCold}`);

  // 2. Fetch all menu items
  const { data: menuItems, error: menuError } = await supabase
    .from("menu_items")
    .select("*, category:menu_categories(name)")
    .eq("restaurant_id", restaurantId);

  if (menuError || !menuItems) {
    throw new Error(`Failed to fetch menu items: ${menuError?.message}`);
  }

  // 3. Fetch item cost details from database view
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

  // 4. Fetch historical order item quantities (last 60 days)
  const sixtyDaysAgo = new Date(tomorrow);
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  const sixtyDaysAgoStr = sixtyDaysAgo.toISOString();

  const { data: orderHistory, error: historyError } = await supabase
    .from("order_items")
    .select("menu_item_id, qty, created_at")
    .eq("restaurant_id", restaurantId)
    .gte("created_at", sixtyDaysAgoStr);

  if (historyError) {
    console.warn("[Forecast Engine] Error fetching order history:", historyError.message);
  }

  const historyRows = orderHistory || [];
  console.log(`Total historical order items fetched (60-day window): ${historyRows.length} rows`);

  const forecasts: DemandForecast[] = [];

  for (const item of menuItems) {
    const categoryName = item.category?.name;
    const itemHistory = historyRows.filter((h) => h.menu_item_id === item.id);
    
    // Day-of-week matching
    const matchingDowRows = itemHistory.filter((h) => new Date(h.created_at).getDay() === targetDayOfWeek);
    const matchingDowQty = matchingDowRows.reduce((sum, h) => sum + h.qty, 0);

    // Distinct matching dates
    const matchingDatesSet = new Set(
      matchingDowRows.map((h) => new Date(h.created_at).toISOString().slice(0, 10))
    );
    const matchingDaysCount = matchingDatesSet.size;

    const totalQtyAllDays = itemHistory.reduce((sum, h) => sum + h.qty, 0);
    const totalDatesSet = new Set(
      itemHistory.map((h) => new Date(h.created_at).toISOString().slice(0, 10))
    );
    const totalDaysCount = totalDatesSet.size;

    let baselineDemand: number;

    if (matchingDaysCount > 0) {
      baselineDemand = matchingDowQty / matchingDaysCount;
    } else if (totalDaysCount > 0) {
      baselineDemand = totalQtyAllDays / totalDaysCount;
    } else {
      baselineDemand = getCategoryFallbackBaseline(item.name, categoryName);
    }

    // B. Apply Weather Adjustment Multiplier
    const itemType = classifyItemType(item.name, categoryName);
    let weatherMultiplier = 1.0;

    if (isRainy) {
      if (itemType === "comfort") {
        weatherMultiplier = 1.20;
      } else if (itemType === "cold") {
        weatherMultiplier = 0.70;
      }
      weatherMultiplier *= 0.85; // general footfall impact
    } else if (isHot) {
      if (itemType === "cold") {
        weatherMultiplier = 1.25;
      } else if (itemType === "comfort") {
        weatherMultiplier = 0.85;
      }
    } else if (isCold) {
      if (itemType === "comfort") {
        weatherMultiplier = 1.20;
      } else if (itemType === "cold") {
        weatherMultiplier = 0.80;
      }
    }

    const adjustedValue = baselineDemand * weatherMultiplier;
    const predictedDemand = Math.max(1, Math.round(adjustedValue));

    // C. Calculate Overstock/Understock Risks and Smart Offer Discounts
    const stock = item.remaining_stock;
    let overstockRisk = false;
    let understockRisk = false;
    let suggestedDiscountPct = 0;
    let floorPrice = Number(item.price);

    const defaultCost = Number(item.price) * 0.35;
    const costs = costMap.get(item.id) || { cost_per_portion: defaultCost, margin_per_portion: Number(item.price) - defaultCost };
    const costPerPortion = costs.cost_per_portion > 0 ? costs.cost_per_portion : defaultCost;
    
    // Minimum margin floor: price must NEVER go below 1.15 * costPerPortion
    const marginFloorPrice = Math.max(costPerPortion * 1.15, Number(item.price) * 0.40);

    if (stock !== null) {
      if (stock > predictedDemand) {
        overstockRisk = true;
        
        // Discount % scales moderately based on excess stock ratio AND profit margin
        const excessPortions = stock - predictedDemand;
        const excessRatio = excessPortions / stock;
        const marginRatio = Math.max(0.2, (Number(item.price) - costPerPortion) / Number(item.price));

        // Base discount calculation (ranging from 10% up to ~22%)
        const rawDiscount = Math.round(10 + excessRatio * 15 * marginRatio);
        
        // Enforce maximum discount ceiling of 25% (realistic restaurant discount cap) and margin floor
        const maxDiscountAllowedByFloor = Math.floor(((Number(item.price) - marginFloorPrice) / Number(item.price)) * 100);
        const MAX_DISCOUNT_CEILING = 25; // Never exceed 25% off on a dish
        
        suggestedDiscountPct = Math.min(MAX_DISCOUNT_CEILING, maxDiscountAllowedByFloor, Math.max(10, rawDiscount));
        floorPrice = Math.max(marginFloorPrice, Number(item.price) * (1 - suggestedDiscountPct / 100));
      } else if (stock < predictedDemand) {
        understockRisk = true;
      }
    }

    // Detailed Log Output per Dish
    console.log(`--------------------------------------------------`);
    console.log(`DISH: "${item.name}" (ID: ${item.id})`);
    console.log(`  Price: ₹${item.price} | Ingredient Cost: ₹${costPerPortion.toFixed(2)} | Stock: ${stock ?? 'Uncapped'}`);
    console.log(`  Order History Rows: ${itemHistory.length} total | Dow (${targetDayName}) Rows: ${matchingDowRows.length} (Qty: ${matchingDowQty})`);
    console.log(`  Baseline Demand (before weather): ${baselineDemand.toFixed(2)} portions`);
    console.log(`  Weather Multiplier: ${weatherMultiplier.toFixed(2)} (${itemType} food in ${weatherCondText})`);
    console.log(`  Value After Weather: ${adjustedValue.toFixed(2)} => Predicted Demand: ${predictedDemand} portions`);
    console.log(`  Risk Assessment: Overstock = ${overstockRisk}, Understock = ${understockRisk}`);
    if (overstockRisk) {
      console.log(`  Suggested Smart Discount: ${suggestedDiscountPct}% Off | Floor Selling Price: ₹${floorPrice.toFixed(2)} (Margin Floor: ₹${marginFloorPrice.toFixed(2)})`);
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
      costPerPortion: Math.round(costPerPortion * 100) / 100,
    });

    // 5. Cache predicted demand in forecast_cache table
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

  console.log(`=================== END FORECAST ENGINE ===================\n`);
  return forecasts;
}
