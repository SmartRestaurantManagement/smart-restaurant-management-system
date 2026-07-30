import { NextRequest, NextResponse } from "next/server";
import { getMenu } from "@/lib/menu/get-menu";
import { recommendDietaryDishes } from "@/lib/ai/gemini";

const INGREDIENT_NUTRITION: Record<string, { caloriesPerKg: number; proteinPerKg: number }> = {
  'chicken': { caloriesPerKg: 1650, proteinPerKg: 310 },
  'mutton': { caloriesPerKg: 2940, proteinPerKg: 250 },
  'paneer': { caloriesPerKg: 3600, proteinPerKg: 180 },
  'butter': { caloriesPerKg: 7170, proteinPerKg: 8 },
  'naan dough': { caloriesPerKg: 2750, proteinPerKg: 80 },
  'rice': { caloriesPerKg: 3600, proteinPerKg: 70 },
  'tomato': { caloriesPerKg: 180, proteinPerKg: 9 },
  'onion': { caloriesPerKg: 400, proteinPerKg: 11 },
  'ginger-garlic paste': { caloriesPerKg: 800, proteinPerKg: 20 },
  'yogurt': { caloriesPerKg: 630, proteinPerKg: 35 },
  'fresh cream': { caloriesPerKg: 3400, proteinPerKg: 20 },
  'chickpeas': { caloriesPerKg: 3640, proteinPerKg: 190 },
  'potato': { caloriesPerKg: 770, proteinPerKg: 20 },
  'cauliflower': { caloriesPerKg: 250, proteinPerKg: 19 },
  'spinach': { caloriesPerKg: 230, proteinPerKg: 29 },
  'green peas': { caloriesPerKg: 810, proteinPerKg: 54 },
  'red lentils': { caloriesPerKg: 3500, proteinPerKg: 240 },
  'black lentils': { caloriesPerKg: 3400, proteinPerKg: 250 },
  'ghee': { caloriesPerKg: 9000, proteinPerKg: 0 },
  'sugar': { caloriesPerKg: 3870, proteinPerKg: 0 },
  'milk': { caloriesPerKg: 600, proteinPerKg: 32 },
  'tea leaves': { caloriesPerKg: 0, proteinPerKg: 0 },
  'coffee powder': { caloriesPerKg: 0, proteinPerKg: 0 },
  'mint leaves': { caloriesPerKg: 440, proteinPerKg: 30 },
  'coriander leaves': { caloriesPerKg: 230, proteinPerKg: 21 },
  'lemon': { caloriesPerKg: 300, proteinPerKg: 11 },
  'semolina': { caloriesPerKg: 3600, proteinPerKg: 120 },
  'mango pulp': { caloriesPerKg: 600, proteinPerKg: 5 },
  'cashew nuts': { caloriesPerKg: 5530, proteinPerKg: 180 },
  'chocolate sauce': { caloriesPerKg: 3400, proteinPerKg: 30 },
  'vanilla essence': { caloriesPerKg: 2500, proteinPerKg: 0 },
  'khoya': { caloriesPerKg: 3800, proteinPerKg: 150 },
  'ice cream mix': { caloriesPerKg: 2000, proteinPerKg: 40 }
};

function calculateNutrition(item: any) {
  let calories = 0;
  let protein = 0;
  if (item.menu_item_ingredients && item.menu_item_ingredients.length > 0) {
    for (const mii of item.menu_item_ingredients) {
      const ingName = mii.ingredients?.name?.toLowerCase() || '';
      const qty = Number(mii.qty_per_portion) || 0;
      const nut = INGREDIENT_NUTRITION[ingName];
      if (nut) {
        calories += qty * nut.caloriesPerKg;
        protein += qty * nut.proteinPerKg;
      }
    }
  }
  
  if (calories === 0) {
    const name = item.name.toLowerCase();
    if (name.includes('chicken') || name.includes('mutton')) {
      calories = 380;
      protein = 28;
    } else if (name.includes('paneer')) {
      calories = 340;
      protein = 16;
    } else if (name.includes('dal') || name.includes('chana') || name.includes('biryani')) {
      calories = 290;
      protein = 12;
    } else if (name.includes('naan') || name.includes('roti') || name.includes('kulcha')) {
      calories = 210;
      protein = 5;
    } else if (name.includes('lassi') || name.includes('coffee') || name.includes('soda')) {
      calories = 180;
      protein = 3;
    } else {
      calories = 150;
      protein = 4;
    }
  }
  
  return {
    calories: Math.round(calories),
    protein: Math.round(protein)
  };
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || typeof body.query !== "string") {
    return NextResponse.json({ error: "query string is required" }, { status: 400 });
  }

  const queryText = body.query.trim();

  try {
    const categories = await getMenu();
    const menuItems = categories.flatMap(cat => 
      cat.menu_items.map(item => {
        const nut = calculateNutrition(item);
        const ingredients = (item.menu_item_ingredients || []).map(mii => mii.ingredients?.name || "").filter(Boolean);
        return {
          name: item.name,
          price: Number(item.price),
          description: item.description || "",
          category: cat.name,
          protein: nut.protein,
          calories: nut.calories,
          ingredients
        };
      })
    );

    // Call LLM recommendDietaryDishes
    try {
      const response = await recommendDietaryDishes(queryText, menuItems);
      return NextResponse.json(response);
    } catch (llmErr) {
      console.warn("LLM recommendDietaryDishes failed, running local heuristic search:", llmErr);
      
      // Local Heuristic Fallback
      const queryLower = queryText.toLowerCase();
      
      const wantsJain = queryLower.includes("jain");
      const wantsVegan = queryLower.includes("vegan");
      const wantsVeg = queryLower.includes("veg") && !queryLower.includes("non-veg") && !queryLower.includes("non veg");
      const wantsSweet = queryLower.includes("sweet") || queryLower.includes("dessert") || queryLower.includes("sugar");
      const wantsEggless = queryLower.includes("eggless") || queryLower.includes("no egg") || queryLower.includes("without egg");
      const wantsHighProtein = queryLower.includes("high-protein") || queryLower.includes("high protein") || queryLower.includes("protein");
      const wantsSpicy = queryLower.includes("spicy") && !queryLower.includes("not too spicy") && !queryLower.includes("not spicy") && !queryLower.includes("non-spicy") && !queryLower.includes("less spicy");
      const wantsNotSpicy = queryLower.includes("not too spicy") || queryLower.includes("not spicy") || queryLower.includes("non-spicy") || queryLower.includes("less spicy") || queryLower.includes("mild");
      
      let priceLimit = 999999;
      const priceMatches = queryLower.match(/(?:under|below|less than|max|maximum|budget)?\s*(?:rs\.?|inr|₹)?\s*(\d+)/);
      if (priceMatches && priceMatches[1]) {
        priceLimit = parseInt(priceMatches[1], 10);
      }

      const suggestions: Array<{ name: string; reason: string }> = [];
      
      for (const item of menuItems) {
        if (item.price > priceLimit) continue;

        const itemLower = item.name.toLowerCase();
        const descLower = item.description.toLowerCase();
        const catLower = item.category.toLowerCase();
        
        let matches = true;
        const reasons: string[] = [];

        // 1. Veg Check (If specifically requested OR required implicitly by Jain/Vegan)
        const isNonVeg = itemLower.includes("chicken") || itemLower.includes("mutton") || 
                          descLower.includes("chicken") || descLower.includes("mutton") || 
                          catLower.includes("non-veg");
        if (wantsVeg || wantsJain || wantsVegan) {
          if (isNonVeg) {
            matches = false;
          } else {
            reasons.push("Pure vegetarian");
          }
        }

        // 2. Jain Check (No Onion, Garlic, Potato, Ginger)
        if (wantsJain) {
          const onionGarlicRoots = ["onion", "garlic", "potato", "ginger"];
          const containsRoots = item.ingredients.some(ing => onionGarlicRoots.some(root => ing.toLowerCase().includes(root))) ||
                                onionGarlicRoots.some(root => itemLower.includes(root)) ||
                                onionGarlicRoots.some(root => descLower.includes(root));
          if (containsRoots) {
            matches = false;
          } else {
            reasons.push("Jain-friendly (no root ingredients)");
          }
        }

        // 3. Vegan Check (No Meat, Dairy, Egg, Honey, Ghee, Yogurt, Milk, Cream, Khoya, Paneer)
        if (wantsVegan) {
          const animalProducts = ["chicken", "mutton", "egg", "fish", "dairy", "yogurt", "milk", "butter", "ghee", "cream", "khoya", "paneer", "ice cream"];
          const containsAnimal = item.ingredients.some(ing => animalProducts.some(p => ing.toLowerCase().includes(p))) ||
                                 animalProducts.some(p => itemLower.includes(p)) ||
                                 animalProducts.some(p => descLower.includes(p));
          if (containsAnimal) {
            matches = false;
          } else {
            reasons.push("100% plant-based vegan");
          }
        }

        // 4. Sweet Check
        if (wantsSweet) {
          const isSweet = catLower.includes("dessert") || 
                          catLower.includes("beverage") || 
                          itemLower.includes("lassi") || itemLower.includes("jamun") || 
                          itemLower.includes("rasmalai") || itemLower.includes("kulfi") || 
                          itemLower.includes("ice cream") || itemLower.includes("brownie") || 
                          itemLower.includes("sweet") || descLower.includes("sweet") ||
                          item.ingredients.some(ing => ing.toLowerCase().includes("sugar") || ing.toLowerCase().includes("mango pulp") || ing.toLowerCase().includes("chocolate"));
          if (!isSweet) {
            matches = false;
          } else {
            reasons.push("Naturally sweet and refreshing");
          }
        }

        // 5. Eggless Check
        if (wantsEggless) {
          const isEgg = itemLower.includes("egg") || descLower.includes("egg");
          if (isEgg) {
            matches = false;
          } else {
            reasons.push("Eggless preparation");
          }
        }

        // 6. High Protein Check
        if (wantsHighProtein) {
          if (item.protein < 15) {
            matches = false;
          } else {
            reasons.push(`Rich in protein (${item.protein}g)`);
          }
        }

        // 7. Spicy Check
        if (wantsSpicy) {
          const isSpicy = itemLower.includes("chilli") || itemLower.includes("65") || descLower.includes("spicy") || descLower.includes("masala") || itemLower.includes("rogan");
          if (!isSpicy) {
            matches = false;
          } else {
            reasons.push("Spicy & flavorful");
          }
        } else if (wantsNotSpicy) {
          const isSpicy = itemLower.includes("chilli") || itemLower.includes("65") || descLower.includes("spicy") || itemLower.includes("rogan");
          if (isSpicy) {
            matches = false;
          } else {
            reasons.push("Mild and not too spicy");
          }
        }

        if (matches) {
          const priceReason = priceLimit !== 999999 ? `Budget under ₹${priceLimit}` : `Priced at ₹${item.price}`;
          reasons.unshift(priceReason);
          suggestions.push({
            name: item.name,
            reason: reasons.join(", ")
          });
        }
      }

      const finalSuggestions = suggestions.slice(0, 3);
      
      let explanation = "";
      if (finalSuggestions.length > 0) {
        explanation = `Here are some excellent options that match your preferences: ${finalSuggestions.map(s => s.name).join(", ")}. Let me know if you would like me to refine this selection!`;
      } else {
        explanation = `I couldn't find any dishes that match all of those constraints perfectly. Try adjusting your request or search criteria.`;
      }

      return NextResponse.json({
        suggestions: finalSuggestions,
        explanation
      });
    }
  } catch (error: any) {
    console.error("Smart Dietary Assistant failed completely:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal assistant error" },
      { status: 500 }
    );
  }
}
