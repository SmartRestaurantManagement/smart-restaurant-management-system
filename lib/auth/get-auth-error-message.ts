/**
 * @supabase/auth-js discards the real response body for any 5xx status
 * (see its fetch.js handleError: NETWORK_ERROR_CODES branch throws before
 * ever calling error.json()), falling back to JSON.stringify() on the raw
 * fetch Response object - which has no enumerable properties, so it always
 * stringifies to the literal string "{}". That's an SDK limitation, not
 * something readable to recover client-side; the best we can do is detect
 * it and show an honest, generic message instead of the raw "{}".
 */
export function getAuthErrorMessage(error: unknown): string {
  if (!error) return "Something went wrong. Please try again.";

  const err = error as { message?: unknown; status?: number };
  const message = typeof err.message === "string" ? err.message.trim() : "";

  if (message && message !== "{}" && message !== "[object Object]") {
    return message;
  }

  if (typeof err.status === "number") {
    return `Server error (status ${err.status}). Please try again in a moment.`;
  }

  return "Something went wrong. Please try again.";
}
