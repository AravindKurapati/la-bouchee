# La Bouchée

A public meal diary with an agentic intake flow and stats-heavy public dashboard.

## Run

```bash
npm install
npm run dev
```

Then open:

```text
http://localhost:4266
```

The app uses Node's built-in HTTP server, LangGraph for the intake workflow, and either Supabase or `data/meals.json` for meal storage.

## Log Meals

Open the app and go to the `Log Meal` tab. Pick the date and meal type, write the raw meal text, run the agents, then publish the generated public caption. The meal is written to Supabase when configured, otherwise it is appended to `data/meals.json`.

On Vercel, persistent hosted writes require Supabase env vars. Without them, the app can still serve seeded data, but public logging is blocked because serverless file writes are not durable.

Publishing/deleting meals is **owner-only** once a hosted database is configured: you must sign in via magic link as `OWNER_EMAIL` (see [Authentication](#authentication)). Comments stay open to the public with a light per-IP rate limit. On localhost with the JSON fallback there is no auth gate.

## Backend

The backend is split between `server.mjs` for local development and Vercel serverless handlers in `api/` for production. Both use the same shared modules in `src/`:

- `src/store.mjs` reads and writes meal records through Supabase when configured, with a local JSON fallback.
- `src/stats.mjs` computes the public dashboard metrics.
- `src/agentGraph.mjs` runs the LangGraph intake workflow.

### Supabase Setup

Run `supabase/schema.sql` in the Supabase SQL editor, then set these environment variables locally and in Vercel:

```text
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_ANON_KEY=...        # public/publishable key (also exposed to the browser)
OWNER_EMAIL=you@example.com  # the only address allowed to publish
```

Use the service role key only on the server. It is intentionally never referenced by browser code. The anon key is public by design and is served to the browser via `GET /api/config`.

### Authentication

Writes (`/api/analyze`, `POST /api/meals`, `DELETE /api/meals/:id`) are restricted to the owner once a hosted database is present:

1. In Supabase, go to **Auth → Users → Add user** and create the user matching `OWNER_EMAIL`. Because sign-in uses `shouldCreateUser: false`, no other email can ever register.
   - Also add your site origin (e.g. `https://your-app.vercel.app` and `http://localhost:4266`) under **Auth → URL Configuration → Redirect URLs**, or the magic-link redirect will be rejected.
2. Open the app, switch to **Log Meal**, enter your email, and click **Send magic link**.
3. Click the link in your inbox. You return signed in, and the meal console unlocks.

The server verifies each write by calling `supabase.auth.getUser(token)` and checking the email against `OWNER_EMAIL`. If a hosted DB is configured but `SUPABASE_ANON_KEY`/`OWNER_EMAIL` are missing, writes **fail closed** with a 503. See `documents/FEATURE_owner_auth.md` and `SCHEMA.md`.

### Tests

```bash
npm test
```

Covers stats computation, the agent parser/privacy redaction, the comment rate limiter, and the owner-auth gate (`node --test`, no extra dependencies).

To import the seeded `data/meals.json` records into Supabase:

```bash
npm run import:supabase
```

### Tool Behavior Ideas

The LangGraph workflow is currently deterministic. Useful tool-backed behaviors to add next:

- `meal-history-tool`: compare a draft against recent meals before deciding whether it is new, familiar, or routine.
- `habit-backfill-tool`: turn a count like "all days except 3" into exact dated pre-breakfast entries after a quick confirmation step.
- `nutrition-lookup-tool`: enrich foods with rough protein/fiber/caffeine tags.
- `weekly-summary-tool`: generate a public weekly digest from Supabase meals and comments.
- `review-gate-tool`: route low-confidence or privacy-risk drafts to a review state before publishing.

## Color Preview

Open `/color-preview.html` while the server is running to compare three possible color directions. It does not change the main dashboard.

## What Is Agentic Here

The intake workflow lives in `src/agentGraph.mjs`:

- `privacy-agent` redacts sensitive details and flags publish risk.
- `parser-agent` extracts structured foods from a raw meal note.
- `tagger-agent` assigns tags, cuisine, source, and texture signals.
- `caption-agent` creates the public caption.
- `memory-agent` queues the published record for public stats.

That workflow is implemented as a LangGraph `StateGraph` without requiring an API key. If you want real LLM behavior next, this module is the place to swap individual deterministic nodes for LangChain model/tool nodes while keeping the server and UI unchanged.

## Comments

Friends can comment on any public meal. Comments are stored in Supabase when configured, or on the meal record in `data/meals.json` during local JSON fallback. They are available through `POST /api/meals/:id/comments` and appear as floating reaction bubbles on the public board.

## Cool Stats Included

- 35-day pre-breakfast/breakfast/lunch/dinner routine map
- floating friend reactions
- top foods bar chart
- home vs outside source split
- entropy score
- repeat gravity
- breakfast anchor
- public completeness
- longest food streak
- top foods and source split
