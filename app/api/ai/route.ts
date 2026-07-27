import { NextRequest, NextResponse } from "next/server";
import { explainAllergenConflict, generateAnalyticsInsights } from "@/lib/ai/gemini";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { type } = body as { type?: string };

  if (type === "allergen_explain") {
    const { item_name, allergens, ingredients } = body as {
      item_name?: string;
      allergens?: string[];
      ingredients?: string[];
    };

    if (!item_name || !allergens || !ingredients) {
      return NextResponse.json(
        { error: "item_name, allergens, and ingredients are required" },
        { status: 400 }
      );
    }

    try {
      const response = await explainAllergenConflict(item_name, allergens, ingredients);
      return NextResponse.json(response);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Allergen explanation failed" },
        { status: 500 }
      );
    }
  }

  if (type === "analytics_insights") {
    const { forecasts, weather_condition, temp_max_c } = body as {
      forecasts?: Array<{
        name: string;
        remainingStock: number | null;
        predictedDemand: number;
        overstockRisk: boolean;
        suggestedDiscountPct: number;
      }>;
      weather_condition?: string;
      temp_max_c?: number;
    };

    console.log(`[API AI Insights] Request received. Forecasts count: ${forecasts?.length}, weather: ${weather_condition}, temp: ${temp_max_c}`);

    if (!forecasts || !weather_condition || temp_max_c === undefined) {
      return NextResponse.json(
        { error: "forecasts, weather_condition, and temp_max_c are required" },
        { status: 400 }
      );
    }

    try {
      const result = await generateAnalyticsInsights(
        forecasts,
        weather_condition,
        temp_max_c
      );
      console.log(`[API AI Insights] Generated insights using provider: ${result.provider}. Error if any: ${result.error || "none"}`);
      return NextResponse.json({ 
        insights: result.insights, 
        provider: result.provider,
        error: result.error || null 
      });
    } catch (e) {
      console.error("[API AI Insights] Error generating insights:", e);
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Analytics insights generation failed" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ error: "Invalid request type" }, { status: 400 });
}
