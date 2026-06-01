import { createClient } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "./store.mjs";

function ownerEmail() {
  return (process.env.OWNER_EMAIL || "").trim().toLowerCase();
}

function anonKey() {
  return process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "";
}

export function isAuthConfigured() {
  return Boolean(process.env.SUPABASE_URL && anonKey() && ownerEmail());
}

// Safe to expose to the browser: the anon key is public by design.
export function publicConfig() {
  return {
    supabaseUrl: process.env.SUPABASE_URL || "",
    supabaseAnonKey: anonKey(),
    authEnabled: isAuthConfigured()
  };
}

let authClient;
function getAuthClient() {
  if (!authClient) {
    authClient = createClient(process.env.SUPABASE_URL, anonKey(), {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }
  return authClient;
}

function bearerToken(req) {
  const header = req?.headers?.authorization || req?.headers?.Authorization || "";
  const match = /^Bearer\s+(.+)$/i.exec(String(header));
  return match ? match[1].trim() : "";
}

function withStatus(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

// Throws unless the request carries a valid session for the configured owner.
// Returns null (allow) for pure local JSON dev where there is no hosted DB.
export async function requireOwner(req) {
  if (!isSupabaseConfigured()) return null;

  if (!isAuthConfigured()) {
    throw withStatus(
      "Owner auth is not configured. Set SUPABASE_ANON_KEY and OWNER_EMAIL to enable publishing.",
      503
    );
  }

  const token = bearerToken(req);
  if (!token) throw withStatus("Sign in required.", 401);

  const { data, error } = await getAuthClient().auth.getUser(token);
  if (error || !data?.user) throw withStatus("Invalid or expired session.", 401);

  const email = (data.user.email || "").trim().toLowerCase();
  if (!email || email !== ownerEmail()) throw withStatus("Not authorized.", 403);

  return data.user;
}
