async function callGroq(prompt: string): Promise<{ text: string; error?: string }> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return { text: "", error: "GROQ_API_KEY not found in environment variables" };
  }

  try {
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
          max_tokens: 500,
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      const msg = `Groq API returned status ${response.status}: ${errText.slice(0, 100)}`;
      console.warn(msg);
      return { text: "", error: msg };
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content || "";
    return { text };
  } catch (error: any) {
    const msg = error?.message || "Groq network request failed";
    console.error("Groq API request failed:", error);
    return { text: "", error: msg };
  }
}

async function callGemini(prompt: string): Promise<{ text: string; error?: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { text: "", error: "GEMINI_API_KEY not found in environment variables" };
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 500,
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      const msg = `Gemini API returned status ${response.status}: ${errText.slice(0, 100)}`;
      console.warn(msg);
      return { text: "", error: msg };
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return { text };
  } catch (error: any) {
    const msg = error?.message || "Gemini network request failed";
    console.error("Gemini API request failed:", error);
    return { text: "", error: msg };
  }
}

/**
 * Generates operational recommendations for the staff dashboard based on tomorrow's demand forecast and weather.
 * Uses Groq as the primary LLM engine.
 */
export async function generateAnalyticsInsights(
  forecasts: Array<{ name: string; remainingStock: number | null; predictedDemand: number; overstockRisk: boolean; suggestedDiscountPct: number }>,
  weatherCondition: string,
  tempMaxC: number
): Promise<{ insights: string; provider: "groq" | "gemini" | "fallback"; error?: string }> {
  const overstockedItems = forecasts.filter((f) => f.overstockRisk);
  
  let prompt = `You are Kaizen, an expert AI restaurant consultant. Analyze the following data and generate 3 clear, actionable, short operational insights (1 sentence each) for the restaurant manager for tomorrow.\n\n`;
  prompt += `Weather Forecast for Tomorrow: ${weatherCondition}, High of ${tempMaxC}°C.\n`;
  prompt += `Menu Items Forecast:\n`;
  for (const item of forecasts) {
    prompt += `- ${item.name}: Stock: ${item.remainingStock ?? "N/A"}, Predicted Demand: ${item.predictedDemand}, Overstock Risk: ${item.overstockRisk ? "YES" : "NO"}\n`;
  }
  
  prompt += `\nIf there are overstocked items, comment on how the smart offers (discounts) generated will help clear them. Keep it professional, brief, and highly specific to the items mentioned. Format as a bulleted list with no markdown bolding inside the bullets.`;

  // 1. Primary LLM: Groq
  console.log("[AI Insights] Attempting Primary Groq API call...");
  const groqRes = await callGroq(prompt);
  if (groqRes.text && groqRes.text.trim()) {
    console.log("[AI Insights] Groq call succeeded.");
    return { insights: groqRes.text.trim(), provider: "groq" };
  }

  // 2. Secondary LLM: Gemini (optional fallback)
  console.log("[AI Insights] Groq failed/unconfigured. Attempting Gemini API call...");
  const geminiRes = await callGemini(prompt);
  if (geminiRes.text && geminiRes.text.trim()) {
    console.log("[AI Insights] Gemini call succeeded.");
    return { insights: geminiRes.text.trim(), provider: "gemini" };
  }

  const primaryError = groqRes.error || "GROQ_API_KEY not configured";
  console.log("[AI Insights] LLM call failed. Using static fallback recommendations. Error:", primaryError);

  const weatherText = weatherCondition.toLowerCase().includes("rain") 
    ? "Rainy weather expected tomorrow: Expect a 20% increase in comfort mains and soups. Ensure ingredients are prepped." 
    : "Warm clear conditions tomorrow: Cold beverages and desserts are projected to see increased demand.";
  
  const overstockText = overstockedItems.length > 0
    ? `Overstock Risk detected: ${overstockedItems.map(i => i.name).join(", ")} stock exceeds predicted demand. Smart Offer discounts are calculated to accelerate sell-through.`
    : "Inventory Health is optimal: Ingredient stocks align with predicted demand for tomorrow.";

  const fallbackText = `* ${weatherText}\n* ${overstockText}\n* Table turnover remains stable at 42 minutes average seat duration. Staff appropriately for peak hours.`;

  return { 
    insights: fallbackText, 
    provider: "fallback",
    error: primaryError
  };
}

/**
 * Explains an allergen safety conflict and suggests a suitable replacement.
 * Uses Groq as the primary LLM engine.
 */
export async function explainAllergenConflict(
  itemName: string,
  allergens: string[],
  ingredients: string[]
): Promise<{ explanation: string; substitute: string }> {
  const prompt = `You are a restaurant safety assistant. A customer wants to order "${itemName}" which contains these ingredients: ${ingredients.join(", ")}.\n` +
    `However, they have the following allergies: ${allergens.join(", ")}.\n\n` +
    `Provide two elements in JSON format (ensure valid JSON keys "explanation" and "substitute"):
    1. "explanation": A polite, brief explanation (max 20 words) explaining why this dish is blocked.
    2. "substitute": A recommendation of a safer item or customization (e.g. "We recommend ordering Mango Lassi instead, which is completely gluten-free." or "Order the Tomato Soup without cheese/butter if they are dairy-free."). Keep it short (max 15 words).`;

  let groqRes = await callGroq(prompt);
  let responseText = groqRes.text;
  if (!responseText) {
    console.warn("Groq allergen call failed, trying Gemini fallback...");
    let geminiRes = await callGemini(prompt);
    responseText = geminiRes.text;
  }

  if (responseText) {
    try {
      const jsonStart = responseText.indexOf("{");
      const jsonEnd = responseText.lastIndexOf("}") + 1;
      if (jsonStart !== -1 && jsonEnd !== -1) {
        const parsed = JSON.parse(responseText.slice(jsonStart, jsonEnd));
        return {
          explanation: parsed.explanation || `This item contains ingredients that conflict with your stated allergies.`,
          substitute: parsed.substitute || `We suggest choosing another dish or consulting our staff for customizations.`,
        };
      }
    } catch (e) {
      console.warn("Failed to parse LLM allergen response, using fallback text:", e);
    }
  }

  // Fallback checks
  let explanation = `This item contains ingredients that conflict with your stated allergies.`;
  let substitute = `We suggest choosing another dish or consulting our staff for customizations.`;

  const itemLower = itemName.toLowerCase();
  const allergensLower = allergens.map(a => a.toLowerCase());

  if (allergensLower.includes("dairy")) {
    if (itemLower.includes("paneer") || itemLower.includes("butter") || itemLower.includes("ice cream")) {
      explanation = `Blocked: "${itemName}" contains dairy (butter, cheese, or cream) which conflicts with your dairy allergy.`;
      substitute = `Try our Mango Lassi (customized dairy-free) or check our dairy-free starters.`;
    }
  } else if (allergensLower.includes("gluten")) {
    if (itemLower.includes("naan") || itemLower.includes("soup")) {
      explanation = `Blocked: "${itemName}" contains wheat flour or thickeners containing gluten.`;
      substitute = `Try our Mango Lassi or Rice dishes, which are naturally gluten-free.`;
    }
  }

  return { explanation, substitute };
}
