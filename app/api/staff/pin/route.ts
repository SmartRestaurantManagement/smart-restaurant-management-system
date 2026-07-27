import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createUnlockToken, verifyUnlockToken, UNLOCK_COOKIE_NAME } from "@/lib/staff/pin-session";

/**
 * Sets/changes the one shared dashboard PIN. No login required - knowing
 * the CURRENT PIN (proven by already holding a valid unlock cookie) is
 * what authorizes changing it now, not any per-account check.
 */
export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const existingToken = cookieStore.get(UNLOCK_COOKIE_NAME)?.value;

  if (!verifyUnlockToken(existingToken)) {
    return NextResponse.json(
      { error: "Dashboard is locked. Unlock it before changing the PIN." },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => null);
  const pin = (body as Record<string, unknown> | null)?.pin;

  if (typeof pin !== "string" || !/^[0-9]{4,6}$/.test(pin)) {
    return NextResponse.json(
      { error: "PIN must be 4 to 6 digits" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_dashboard_pin", { p_pin: pin });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
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
