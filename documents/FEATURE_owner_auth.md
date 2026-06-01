# FEATURE: Owner authentication + comment abuse guards

## Problem
The deployment URL is public. Today the write endpoints have **no auth**:

- `POST /api/meals` — anyone can publish meals to the public board.
- `POST /api/analyze` — anyone can run the agent pipeline (compute abuse).
- `POST /api/meals/:id/comments` — anyone can comment, with no rate limit.
- `DELETE /api/meals/:id` — exists only on the local server; **missing** on Vercel.

This is a single-author meal diary: the owner publishes meals; friends only read
and comment.

## Decision
- **Writes are owner-only**, enforced with **Supabase Auth** (chosen by the owner).
  - Browser signs in via **magic link** (`signInWithOtp`, implicit flow,
    `shouldCreateUser: false`).
  - The frontend attaches `Authorization: Bearer <access_token>` to admin calls.
  - The server verifies the token with `supabase.auth.getUser(token)` using the
    **anon/publishable** key, then checks `user.email === OWNER_EMAIL`.
  - Service-role key is still used for the actual DB writes (after the owner check).
- **Comments stay public** (the social feature) with light guards:
  - Best-effort in-memory per-IP sliding-window rate limit.
  - Existing length caps + control-char stripping retained.
- **Fail closed**: if a hosted DB is configured (`isSupabaseConfigured()`) but owner
  auth is not (`SUPABASE_ANON_KEY` + `OWNER_EMAIL` missing), writes return `503`.
- **Local JSON dev** (no hosted DB) keeps working with no auth — localhost only.

## Why not full RLS-enforced writes from the browser
All DB access already flows through the service-role key on the server. Verifying the
JWT in the handler + keeping service-role writes is the smallest change that fully
secures the public URL, with no rewrite of the store layer. RLS policies are added as
documentation / defense-in-depth (see SCHEMA.md), but are not load-bearing because
table access never uses the anon key.

## New env vars
| Var | Where | Purpose |
|-----|-------|---------|
| `SUPABASE_ANON_KEY` (or `SUPABASE_PUBLISHABLE_KEY`) | server + exposed to browser via `/api/config` | verify owner JWT; browser auth client. Public by design. |
| `OWNER_EMAIL` | server only | the single email allowed to publish. |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are unchanged.

## One-time setup
Create the owner user once in Supabase: **Auth → Users → Add user**, with the
`OWNER_EMAIL` address. Because `shouldCreateUser` is `false`, no other email can sign in.

## New endpoint
- `GET /api/config` → `{ supabaseUrl, supabaseAnonKey, authEnabled }` (no secrets).

## Database impact
- **No table/column changes.** `data/meals.json` and `meals`/`comments` tables unchanged.
- `supabase/schema.sql` gains RLS **read** policies (public can read public meals +
  their comments). Writes have no anon policy → default deny. See SCHEMA.md.

## New / changed files
- `src/auth.mjs` (new) — `requireOwner(req)`, `isAuthConfigured()`, `publicConfig()`.
- `src/rateLimit.mjs` (new) — `rateLimit()`, `clientIp()`, `enforceCommentRateLimit()`.
- `api/config.js` (new), `api/meals/[id].js` (new — DELETE).
- `server.mjs`, `api/meals.js`, `api/analyze.js`, `api/meals/[id]/comments.js` — wired.
- `public/auth.js` (new), `public/app.js`, `public/index.html`, `public/styles.css` — sign-in UI + bearer token.
- `test/` (new) — stats, agent parser/privacy, rate limiter, auth gate.

## Out of scope
- Multi-user accounts, roles, password login.
- Durable cross-instance rate limiting (would need a table; documented as best-effort).
