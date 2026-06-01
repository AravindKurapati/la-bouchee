// Browser-side owner auth via Supabase magic link (implicit flow).
// When auth is not configured on the server (pure local JSON dev), this module
// reports `enabled: false` and the admin console works without sign-in.

let client = null;
let config = { authEnabled: false };
let session = null;
const listeners = new Set();

function notify() {
  const snapshot = getAuthState();
  listeners.forEach((fn) => fn(snapshot));
}

export async function initAuth() {
  try {
    config = await fetch("/api/config").then((response) => response.json());
  } catch {
    config = { authEnabled: false };
  }
  if (!config.authEnabled) return getAuthState();

  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      flowType: "implicit",
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true
    }
  });

  const { data } = await client.auth.getSession();
  session = data.session;

  client.auth.onAuthStateChange((_event, nextSession) => {
    session = nextSession;
    // Strip the magic-link token fragment from the URL after a successful return.
    if (nextSession && window.location.hash.includes("access_token")) {
      const clean = window.location.pathname + window.location.search;
      window.history.replaceState(null, "", clean);
    }
    notify();
  });

  return getAuthState();
}

export function getAuthState() {
  return {
    enabled: Boolean(config.authEnabled),
    signedIn: Boolean(session),
    email: session?.user?.email || ""
  };
}

export function onAuthChange(fn) {
  listeners.add(fn);
}

export async function sendMagicLink(email) {
  if (!client) throw new Error("Auth is not configured on this deployment.");
  const { error } = await client.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${window.location.origin}/?view=admin`
    }
  });
  if (error) throw new Error(error.message);
}

export async function signOut() {
  if (client) await client.auth.signOut();
  session = null;
  notify();
}

export function authHeaders() {
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}
