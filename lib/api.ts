import { loadPassword } from "./storage";

/**
 * Headers for POSTing JSON to the /api routes. Includes the access password
 * (from localStorage) when one has been set — the server enforces it only if
 * APP_PASSWORD is configured, so this is a no-op for local use.
 */
export function apiHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const pw = loadPassword();
  if (pw) headers["x-app-password"] = pw;
  return headers;
}
