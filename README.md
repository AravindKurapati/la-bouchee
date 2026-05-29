# La Bouchée

A public meal diary with an agentic intake flow and stats-heavy public dashboard.

## Run

```bash
npm run dev
```

Then open:

```text
http://localhost:4266
```

No install step is required for the current MVP. It uses Node's built-in HTTP server and stores meals in `data/meals.json`.

## Log Meals

Open the app and go to the `Log Meal` tab. Pick the date and meal type, write the raw meal text, run the agents, then publish the generated public caption. The meal is appended to `data/meals.json`.

## Color Preview

Open `/color-preview.html` while the server is running to compare three possible color directions. It does not change the main dashboard.

## What Is Agentic Here

The intake workflow lives in `src/agentGraph.mjs`:

- `privacy-agent` redacts sensitive details and flags publish risk.
- `parser-agent` extracts structured foods from a raw meal note.
- `tagger-agent` assigns tags, cuisine, source, and texture signals.
- `caption-agent` creates the public caption.
- `memory-agent` queues the published record for public stats.

That is intentionally graph-shaped without requiring an API key. If you want real LLM behavior next, this module is the place to swap in LangGraph/LangChain nodes while keeping the server and UI unchanged.

## Comments

Friends can comment on any public meal. Comments are stored on the meal record in `data/meals.json`, are available through `POST /api/meals/:id/comments`, and appear as floating reaction bubbles on the public board.

## Cool Stats Included

- 35-day breakfast/lunch/dinner heatmap
- flavor constellation from top tags
- plate radar for public eating identity
- entropy score
- repeat gravity
- breakfast anchor
- public completeness
- longest food streak
- top foods and source split
