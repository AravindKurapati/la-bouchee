// Creates (or confirms) the single owner user allowed to publish meals.
//
// Usage (env vars must be present in the shell or loaded with --env-file):
//   node --env-file=.env scripts/create-owner.mjs
//   OWNER_EMAIL=you@example.com node scripts/create-owner.mjs
//   node scripts/create-owner.mjs you@example.com   (email as arg overrides env)
//
// Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY. The service-role key is
// only used here on your machine and is never sent to the browser.

import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = (process.argv[2] || process.env.OWNER_EMAIL || "").trim();

if (!url || !serviceRoleKey) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}
if (!email) {
  console.error("Provide the owner email via OWNER_EMAIL or as the first argument.");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const { error } = await supabase.auth.admin.createUser({
  email,
  email_confirm: true
});

if (error) {
  const alreadyExists = /already.*(registered|exists)/i.test(error.message || "");
  if (alreadyExists) {
    console.log(`Owner user ${email} already exists. Nothing to do.`);
    process.exit(0);
  }
  console.error(`Failed to create owner user: ${error.message}`);
  process.exit(1);
}

console.log(`Created owner user ${email}.`);
console.log("Next: sign in from the Log Meal tab via the magic link sent to this address.");
console.log("Reminder: set OWNER_EMAIL to this address in your server/Vercel env, and add");
console.log("your site origin under Supabase Auth -> URL Configuration -> Redirect URLs.");
