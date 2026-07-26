import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const status = {
    supabase: { healthy: false, message: "Disconnected" },
    gemini: { healthy: false, message: "Not configured" },
    groq: { healthy: false, message: "Not configured" },
    openMeteo: { healthy: false, message: "Unreachable" },
  };

  // 1. Check Supabase
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("restaurants").select("id").limit(1);
    if (!error) {
      status.supabase = { healthy: true, message: "Connected" };
    } else {
      status.supabase = { healthy: false, message: error.message };
    }
  } catch (err: any) {
    status.supabase = { healthy: false, message: err.message || "Connection failed" };
  }

  // 2. Check Gemini Reachability
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`);
      if (res.status === 200) {
        status.gemini = { healthy: true, message: "Active & Reachable" };
      } else {
        status.gemini = { healthy: false, message: `API Error: Status ${res.status}` };
      }
    } catch (err: any) {
      status.gemini = { healthy: false, message: "Unreachable" };
    }
  }

  // 3. Check Groq Reachability
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { Authorization: `Bearer ${groqKey}` },
      });
      if (res.status === 200) {
        status.groq = { healthy: true, message: "Active & Reachable" };
      } else {
        status.groq = { healthy: false, message: `API Error: Status ${res.status}` };
      }
    } catch (err: any) {
      status.groq = { healthy: false, message: "Unreachable" };
    }
  }

  // 4. Check Open-Meteo Reachability
  try {
    const res = await fetch("https://api.open-meteo.com/v1/forecast?latitude=19.076&longitude=72.8777&forecast_days=1");
    if (res.ok) {
      status.openMeteo = { healthy: true, message: "Reachable" };
    } else {
      status.openMeteo = { healthy: false, message: `Status ${res.status}` };
    }
  } catch (err: any) {
    status.openMeteo = { healthy: false, message: "Unreachable" };
  }

  return NextResponse.json(status);
}
