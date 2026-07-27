import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createUnlockToken, UNLOCK_COOKIE_NAME } from "@/lib/staff/pin-session";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const pin = (body as Record<string, unknown> | null)?.pin;

  if (typeof pin !== "string" || !/^[0-9]{4,6}$/.test(pin)) {
    return NextResponse.json({ error: "Invalid PIN" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: isCorrect, error } = await supabase.rpc("verify_dashboard_pin", {
    p_pin: pin,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!isCorrect) {
    return NextResponse.json({ error: "Incorrect PIN" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(UNLOCK_COOKIE_NAME, createUnlockToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
  return response;
}
