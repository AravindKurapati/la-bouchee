import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { isAuthConfigured, isOwnerRequest, publicConfig, requireOwner } from "../src/auth.mjs";

const AUTH_VARS = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_ANON_KEY",
  "SUPABASE_PUBLISHABLE_KEY",
  "OWNER_EMAIL"
];

beforeEach(() => {
  for (const key of AUTH_VARS) delete process.env[key];
});

test("local JSON dev (no hosted DB) allows writes without a token", async () => {
  const user = await requireOwner({ headers: {} });
  assert.equal(user, null);
});

test("fails closed (503) when a hosted DB exists but owner auth is unconfigured", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
  assert.equal(isAuthConfigured(), false);
  await assert.rejects(() => requireOwner({ headers: {} }), (error) => error.statusCode === 503);
});

test("rejects missing token with 401 when auth is configured", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
  process.env.SUPABASE_ANON_KEY = "anon-key";
  process.env.OWNER_EMAIL = "owner@example.com";
  assert.equal(isAuthConfigured(), true);
  await assert.rejects(() => requireOwner({ headers: {} }), (error) => error.statusCode === 401);
});

test("isOwnerRequest allows full reads in local JSON dev (no hosted DB)", async () => {
  assert.equal(await isOwnerRequest({ headers: {} }), true);
});

test("isOwnerRequest denies owner reads to an unauthenticated caller on a hosted DB", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
  process.env.SUPABASE_ANON_KEY = "anon-key";
  process.env.OWNER_EMAIL = "owner@example.com";
  assert.equal(await isOwnerRequest({ headers: {} }), false);
});

test("isOwnerRequest fails closed (public) when owner auth is misconfigured", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
  assert.equal(await isOwnerRequest({ headers: {} }), false);
});

test("publicConfig never leaks the service-role key or owner email", () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
  process.env.SUPABASE_ANON_KEY = "anon-key";
  process.env.OWNER_EMAIL = "owner@example.com";
  const config = publicConfig();
  assert.deepEqual(Object.keys(config).sort(), ["authEnabled", "supabaseAnonKey", "supabaseUrl"]);
  assert.equal(config.supabaseAnonKey, "anon-key");
  assert.equal(JSON.stringify(config).includes("service-role"), false);
  assert.equal(JSON.stringify(config).includes("owner@example.com"), false);
});
