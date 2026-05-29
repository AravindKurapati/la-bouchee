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

On Vercel, persistent hosted writes require Supabase env vars. Without them, the app can still serve seeded data and run analysis, but public logging/comments remain blocked because serverless file writes are not durable.

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
```

Use the service role key only on the server. It is intentionally never referenced by browser code.

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
