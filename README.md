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

The app uses Node's built-in HTTP server, LangGraph for the intake workflow, and `data/meals.json` for local meal storage.

## Log Meals

Open the app and go to the `Log Meal` tab. Pick the date and meal type, write the raw meal text, run the agents, then publish the generated public caption. The meal is appended to `data/meals.json`.

On Vercel, the seeded public log is deployable as a read-only preview. Persistent hosted writes need a database or durable storage before public logging/comments can be shared across visitors.

## Backend

The backend is split between `server.mjs` for local development and Vercel serverless handlers in `api/` for production. Both use the same shared modules in `src/`:

- `src/store.mjs` reads and writes meal records.
- `src/stats.mjs` computes the public dashboard metrics.
- `src/agentGraph.mjs` runs the LangGraph intake workflow.

The current hosted backend can read seeded data and run analysis, but durable public writes are intentionally blocked on Vercel until a database or storage service is connected.

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

Friends can comment on any public meal. Comments are stored on the meal record in `data/meals.json`, are available through `POST /api/meals/:id/comments`, and appear as floating reaction bubbles on the public board.

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
