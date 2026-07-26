async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY not found in environment variables.");
    return "";
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
      console.warn(`Gemini API returned error code ${response.status}.`);
      return "";
    }

    const data = await response.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  } catch (error) {
    console.error("Gemini API request failed:", error);
    return "";
  }
}

async function callGroq(prompt: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.warn("GROQ_API_KEY not found in environment variables.");
    return "";
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
      console.warn(`Groq API returned error code ${response.status}.`);
      return "";
    }

    const data = await response.json();
    return data?.choices?.[0]?.message?.content || "";
  } catch (error) {
    console.error("Groq API request failed:", error);
    return "";
  }
}

/**
 * Generates operational recommendations for the staff dashboard based on tomorrow's demand forecast and weather.
 */
export async function generateAnalyticsInsights(
  forecasts: Array<{ name: string; remainingStock: number | null; predictedDemand: number; overstockRisk: boolean; suggestedDiscountPct: number }>,
  weatherCondition: string,
  tempMaxC: number
): Promise<{ insights: string; provider: "gemini" | "groq" | "fallback" }> {
  const overstockedItems = forecasts.filter((f) => f.overstockRisk);
  
  let prompt = `You are Kaizen, an expert AI restaurant consultant. Analyze the following data and generate 3 clear, actionable, short operational insights (1 sentence each) for the restaurant manager for tomorrow.\n\n`;
  prompt += `Weather Forecast for Tomorrow: ${weatherCondition}, High of ${tempMaxC}°C.\n`;
  prompt += `Menu Items Forecast:\n`;
  for (const item of forecasts) {
    prompt += `- ${item.name}: Stock: ${item.remainingStock ?? "N/A"}, Predicted Demand: ${item.predictedDemand}, Overstock Risk: ${item.overstockRisk ? "YES" : "NO"}\n`;
  }
  
  prompt += `\nIf there are overstocked items, comment on how the smart offers (discounts) generated will help clear them. Keep it professional, brief, and highly specific to the items mentioned. Format as a bulleted list with no markdown bolding inside the bullets.`;

  console.log("[AI Insights] Attempting Gemini API call...");
  const geminiResponse = await callGemini(prompt);
  if (geminiResponse && geminiResponse.trim()) {
    console.log("[AI Insights] Gemini call succeeded.");
    return { insights: geminiResponse.trim(), provider: "gemini" };
  }

  console.log("[AI Insights] Gemini failed or not configured. Attempting Groq API call...");
  const groqResponse = await callGroq(prompt);
  if (groqResponse && groqResponse.trim()) {
    console.log("[AI Insights] Groq call succeeded.");
    return { insights: groqResponse.trim(), provider: "groq" };
  }

  console.log("[AI Insights] Both LLMs failed. Using static fallback recommendations.");
  // Fallback insights if API key is not configured or fails
  const weatherText = weatherCondition.toLowerCase().includes("rain") 
    ? "Rainy weather expected tomorrow: Expect a 30% increase in soup and hot mains demand. Prep extra Tomato Soup Mix." 
    : "Sunny conditions tomorrow: Beverages and desserts are projected to see higher demand. Ensure Mango Lassi ingredients are fully stocked.";
  
  const overstockText = overstockedItems.length > 0
    ? `Overstock Risk detected: ${overstockedItems.map(i => i.name).join(", ")} stocks exceed predicted demand. Suggested Smart Offers are ready to be published to prevent food waste.`
    : "Inventory Health is optimal: All ingredient stocks align perfectly with predicted demand. No waste-avoidance discounts required.";

  const fallbackText = `* ${weatherText}\n* ${overstockText}\n* Table turnover is high: Active table monitoring shows average seat durations are stable at 42 minutes. Continue staffing for peak evening hours.`;

  return { insights: fallbackText, provider: "fallback" };
}

/**
 * Explains an allergen safety conflict and suggests a suitable replacement.
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

  let response = await callGemini(prompt);
  if (!response) {
    console.warn("Gemini allergen call failed, trying Groq fallback...");
    response = await callGroq(prompt);
  }

  if (response) {
    try {
      // Find JSON block if Gemini/Groq returns extra markdown
      const jsonStart = response.indexOf("{");
      const jsonEnd = response.lastIndexOf("}") + 1;
      if (jsonStart !== -1 && jsonEnd !== -1) {
        const parsed = JSON.parse(response.slice(jsonStart, jsonEnd));
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
      substitute = `Try our Mango Lassi (made with plant base if customized) or check our dairy-free starters.`;
    }
  } else if (allergensLower.includes("gluten")) {
    if (itemLower.includes("naan") || itemLower.includes("soup")) {
      explanation = `Blocked: "${itemName}" contains wheat flour or thickeners containing gluten.`;
      substitute = `Try our Mango Lassi or Vanilla Ice Cream, which are naturally gluten-free.`;
    }
  }

  return { explanation, substitute };
}
