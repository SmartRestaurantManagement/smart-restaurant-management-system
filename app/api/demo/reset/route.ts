import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

// Create a Supabase client that bypasses RLS if the service role key is available
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return null;
  }
  return createSupabaseClient<Database>(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function POST(request: NextRequest) {
  // Try to get admin client, fall back to user's client if not available
  const adminClient = getAdminClient();
  const userClient = await createServerClient();
  const supabase = adminClient || userClient;

  try {
    // 1. Get or create the default restaurant
    let { data: restaurant, error: restError } = await supabase
      .from("restaurants")
      .select("*")
      .order("created_at")
      .limit(1)
      .maybeSingle();

    if (restError) {
      return NextResponse.json({ error: "Failed to fetch restaurant: " + restError.message }, { status: 500 });
    }

    if (!restaurant) {
      const { data: newRest, error: newRestError } = await supabase
        .from("restaurants")
        .insert({ name: "Kaizen Living Restaurant" })
        .select()
        .single();

      if (newRestError || !newRest) {
        return NextResponse.json({ error: "Failed to create default restaurant: " + newRestError?.message }, { status: 500 });
      }
      restaurant = newRest;
    }

    const restaurantId = restaurant.id;

    // 2. Clear transactional data
    const tablesToClear = [
      "order_items",
      "orders",
      "bills",
      "service_requests",
      "reservations",
      "forecast_cache",
      "offers",
      "weather_cache",
      "menu_item_ingredients",
      "ingredients",
      "menu_items",
      "menu_categories",
      "tables",
    ];

    // Using RLS-bypassing client if possible, or standard client
    // For order_status_history, since it is not in the type definition, we cast
    try {
      await (supabase as any).from("order_status_history").delete().eq("restaurant_id", restaurantId);
    } catch (e) {
      console.warn("Could not clear order_status_history:", e);
    }

    for (const table of tablesToClear) {
      const { error: clearError } = await supabase
        .from(table as any)
        .delete()
        .eq("restaurant_id", restaurantId);

      if (clearError) {
        console.warn(`Failed to clear table ${table}: ${clearError.message}`);
      }
    }

    // 3. Seed Tables
    const tablesData = [
      { restaurant_id: restaurantId, table_number: 1, status: "free" as const },
      { restaurant_id: restaurantId, table_number: 2, status: "free" as const },
      { restaurant_id: restaurantId, table_number: 3, status: "free" as const },
      { restaurant_id: restaurantId, table_number: 4, status: "free" as const },
      { restaurant_id: restaurantId, table_number: 5, status: "free" as const },
      { restaurant_id: restaurantId, table_number: 6, status: "free" as const },
    ];

    const { error: tablesError } = await supabase.from("tables").insert(tablesData);
    if (tablesError) {
      return NextResponse.json({ error: "Failed to seed tables: " + tablesError.message }, { status: 500 });
    }

    // Get the tables back so we can associate them later
    const { data: dbTables } = await supabase
      .from("tables")
      .select("*")
      .eq("restaurant_id", restaurantId);

    // 4. Seed Menu Categories
    const categoriesData = [
      { restaurant_id: restaurantId, name: "Starters", sort_order: 1 },
      { restaurant_id: restaurantId, name: "Mains", sort_order: 2 },
      { restaurant_id: restaurantId, name: "Desserts", sort_order: 3 },
      { restaurant_id: restaurantId, name: "Beverages", sort_order: 4 },
    ];

    const { data: categories, error: catError } = await supabase
      .from("menu_categories")
      .insert(categoriesData)
      .select();

    if (catError || !categories) {
      return NextResponse.json({ error: "Failed to seed categories: " + catError?.message }, { status: 500 });
    }

    const starterCat = categories.find((c) => c.name === "Starters")!;
    const mainCat = categories.find((c) => c.name === "Mains")!;
    const dessertCat = categories.find((c) => c.name === "Desserts")!;
    const beverageCat = categories.find((c) => c.name === "Beverages")!;

    // 5. Seed Ingredients
    const ingredientsData = [
      { restaurant_id: restaurantId, name: "Tomato", stock_qty: 50.0, low_stock_threshold: 5.0, unit_cost: 10.0 },
      { restaurant_id: restaurantId, name: "Paneer", stock_qty: 20.0, low_stock_threshold: 2.0, unit_cost: 80.0 },
      { restaurant_id: restaurantId, name: "Butter Naan Flour", stock_qty: 15.0, low_stock_threshold: 3.0, unit_cost: 15.0 },
      { restaurant_id: restaurantId, name: "Butter", stock_qty: 30.0, low_stock_threshold: 5.0, unit_cost: 25.0 },
      { restaurant_id: restaurantId, name: "Ice Cream Mix", stock_qty: 10.0, low_stock_threshold: 2.0, unit_cost: 50.0 },
      { restaurant_id: restaurantId, name: "Tomato Soup Mix", stock_qty: 10.0, low_stock_threshold: 2.0, unit_cost: 20.0 },
    ];

    const { data: ingredients, error: ingError } = await supabase
      .from("ingredients")
      .insert(ingredientsData)
      .select();

    if (ingError || !ingredients) {
      return NextResponse.json({ error: "Failed to seed ingredients: " + ingError?.message }, { status: 500 });
    }

    const tomato = ingredients.find((i) => i.name === "Tomato")!;
    const paneer = ingredients.find((i) => i.name === "Paneer")!;
    const flour = ingredients.find((i) => i.name === "Butter Naan Flour")!;
    const butter = ingredients.find((i) => i.name === "Butter")!;
    const icecreamMix = ingredients.find((i) => i.name === "Ice Cream Mix")!;
    const soupMix = ingredients.find((i) => i.name === "Tomato Soup Mix")!;

    // 6. Seed Menu Items
    const menuItemsData = [
      {
        restaurant_id: restaurantId,
        category_id: starterCat.id,
        name: "Tomato Soup",
        description: "Rich and creamy classic tomato soup served with croutons.",
        price: 150.0,
        is_available: true,
        remaining_stock: 10,
      },
      {
        restaurant_id: restaurantId,
        category_id: mainCat.id,
        name: "Paneer Butter Masala",
        description: "Soft paneer cubes simmered in a spiced tomato butter gravy.",
        price: 320.0,
        is_available: true,
        remaining_stock: 20,
      },
      {
        restaurant_id: restaurantId,
        category_id: mainCat.id,
        name: "Butter Naan",
        description: "Clay-oven baked flatbread brushed with fresh butter.",
        price: 60.0,
        is_available: true,
        remaining_stock: 15,
      },
      {
        restaurant_id: restaurantId,
        category_id: dessertCat.id,
        name: "Vanilla Ice Cream",
        description: "Creamy Madagascar vanilla ice cream.",
        price: 120.0,
        is_available: true,
        remaining_stock: 20,
      },
      {
        restaurant_id: restaurantId,
        category_id: beverageCat.id,
        name: "Mango Lassi",
        description: "Refreshing sweet yogurt drink blended with fresh mangoes.",
        price: 90.0,
        is_available: true,
        remaining_stock: null, // Not stock-tracked (no recipe)
      },
    ];

    const { data: menuItems, error: menuItemsError } = await supabase
      .from("menu_items")
      .insert(menuItemsData)
      .select();

    if (menuItemsError || !menuItems) {
      return NextResponse.json({ error: "Failed to seed menu items: " + menuItemsError?.message }, { status: 500 });
    }

    const soupItem = menuItems.find((m) => m.name === "Tomato Soup")!;
    const paneerItem = menuItems.find((m) => m.name === "Paneer Butter Masala")!;
    const naanItem = menuItems.find((m) => m.name === "Butter Naan")!;
    const icecreamItem = menuItems.find((m) => m.name === "Vanilla Ice Cream")!;

    // 7. Seed Recipes (menu_item_ingredients)
    const recipeData = [
      // Tomato Soup: 1 portion Soup Mix, 2 Tomatos
      { restaurant_id: restaurantId, menu_item_id: soupItem.id, ingredient_id: soupMix.id, qty_per_portion: 1.0 },
      { restaurant_id: restaurantId, menu_item_id: soupItem.id, ingredient_id: tomato.id, qty_per_portion: 2.0 },

      // Paneer Butter Masala: 0.2 Paneer, 3 Tomatoes, 0.1 Butter
      { restaurant_id: restaurantId, menu_item_id: paneerItem.id, ingredient_id: paneer.id, qty_per_portion: 0.2 },
      { restaurant_id: restaurantId, menu_item_id: paneerItem.id, ingredient_id: tomato.id, qty_per_portion: 3.0 },
      { restaurant_id: restaurantId, menu_item_id: paneerItem.id, ingredient_id: butter.id, qty_per_portion: 0.1 },

      // Butter Naan: 0.2 Flour, 0.05 Butter
      { restaurant_id: restaurantId, menu_item_id: naanItem.id, ingredient_id: flour.id, qty_per_portion: 0.2 },
      { restaurant_id: restaurantId, menu_item_id: naanItem.id, ingredient_id: butter.id, qty_per_portion: 0.05 },

      // Vanilla Ice Cream: 0.5 Ice Cream Mix
      { restaurant_id: restaurantId, menu_item_id: icecreamItem.id, ingredient_id: icecreamMix.id, qty_per_portion: 0.5 },
    ];

    const { error: recipeError } = await supabase.from("menu_item_ingredients").insert(recipeData);
    if (recipeError) {
      return NextResponse.json({ error: "Failed to seed recipes: " + recipeError.message }, { status: 500 });
    }

    // 8. Re-trigger calculations of menu item stocks in SQL to synchronize
    // (This is run automatically by database triggers, but we can verify it by fetching menu items)
    const { data: finalItems } = await supabase
      .from("menu_items")
      .select("name, remaining_stock")
      .eq("restaurant_id", restaurantId);

    return NextResponse.json({
      success: true,
      message: "Database reset completed successfully. Restored 1 restaurant, 6 tables, 4 categories, 6 ingredients, 5 menu items, and 6 recipe components.",
      data: {
        restaurantId,
        menuItems: finalItems,
      },
    });

  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : "Unexpected error during database reset",
    }, { status: 500 });
  }
}
