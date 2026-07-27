import crypto from "crypto";

export const UNLOCK_COOKIE_NAME = "kaizen_dashboard_unlock";

// Caps how long an unlock lasts even if the browser tab is left open.
// The cookie itself carries no Max-Age/Expires (see the route handlers),
// so it also disappears whenever the browser session ends - whichever
// comes first.
const UNLOCK_HOURS = 4;

// Not tied to any user id - one shared PIN unlocks the dashboard for
// whoever's browser holds this cookie, no login involved.
const MARKER = "dashboard";

function getSecret(): string {
  const secret = process.env.DASHBOARD_PIN_SECRET;
  if (!secret) {
    throw new Error(
      "DASHBOARD_PIN_SECRET is not set. Add a random string to .env.local (e.g. `openssl rand -hex 32`)."
    );
  }
  return secret;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
}

/** Builds a signed, time-limited unlock token. */
export function createUnlockToken(): string {
  const expiresAt = Date.now() + UNLOCK_HOURS * 60 * 60 * 1000;
  const payload = `${MARKER}.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

/** Verifies a token was issued by us and hasn't expired. */
export function verifyUnlockToken(token: string | undefined): boolean {
  if (!token) return false;

  const parts = token.split(".");
  if (parts.length !== 3) return false;

  const [marker, expiresAtRaw, signature] = parts;
  const payload = `${marker}.${expiresAtRaw}`;
  const expectedSignature = sign(payload);

  const signatureBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSignature);
  if (signatureBuf.length !== expectedBuf.length) return false;
  if (!crypto.timingSafeEqual(signatureBuf, expectedBuf)) return false;

  if (marker !== MARKER) return false;

  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;

  return true;
}
