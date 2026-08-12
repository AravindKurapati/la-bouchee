# CLI Meal Log — Design

## Problem

Logging a meal currently requires opening the web UI, picking date/meal type,
typing raw text, running the full agent workflow, and publishing. For quick
personal logging ("ate eggs and toast for breakfast") this is more friction
than the moment deserves. Want a one-shot terminal command that saves the
entry and makes it show up on the live public dashboard immediately.

## Goals

- `npm run log <mealType> "<dish text>"` saves a public meal entry to the
  live Supabase-backed store in one command.
- Keep the privacy safety gate (the one part of the existing pipeline that
  isn't just cosmetic) — refuse to save if a high-severity privacy issue is
  detected, same as the web UI's publish gate.
- Skip parsing/tagging/captioning — not needed for a fast personal log, and
  skipping them avoids running the LangGraph workflow for a CLI one-liner.

## Non-goals

- No interactive prompt mode (one-shot args only, per user preference).
- No CLI auth flow — this is a local script using the service-role key from
  `.env`, matching the existing `create-owner.mjs` / `import-supabase.mjs`
  pattern. It never goes over HTTP or through the owner-auth code path.
- No editing/deleting from the CLI — that stays in the web UI.
- No photo, custom date, or private-visibility support in v1.

## Approach

### 1. Extract the privacy agent

`src/agentGraph.mjs` currently keeps `runPrivacyAgent` as a private function
used only inside the LangGraph pipeline. Export it so the CLI can call it
directly without invoking the rest of the graph:

```js
export function runPrivacyAgent(rawText) { ... } // unchanged body, just exported
```

No behavior change to the existing web/API pipeline — this is a pure export
addition.

### 2. New script: `scripts/log-meal.mjs`

```bash
node --env-file=.env scripts/log-meal.mjs <mealType> <dish text...>
```
wired up as:
```json
"log": "node --env-file=.env scripts/log-meal.mjs"
```

Flow:
1. Parse argv: first arg is `mealType`, remaining args joined with spaces is
   the raw text.
2. Validate `mealType` is one of `pre-breakfast | breakfast | lunch | dinner`.
   Reject anything else with a usage message and exit 1.
3. Reject empty/missing dish text the same way.
4. Run `runPrivacyAgent(rawText)` (imported from `src/agentGraph.mjs`).
5. If `publishable` is `false` (a high-severity issue was found), print the
   flagged issue(s) and exit 1 **without saving**.
6. Otherwise build a meal object:
   ```js
   {
     date: new Date().toISOString().slice(0, 10),
     mealType,
     rawText,
     redactedText: privacy.redactedText,
     foods: [],
     tags: [],
     cuisine: "Mixed",
     source: "unknown",
     photoUrl: "",
     confidence: 0,
     privacyIssues: privacy.issues,
     publishable: true,
     publicCaption: "",
     visibility: "public"
   }
   ```
7. Call `saveMeal(meal)` from `src/store.mjs` (already handles Supabase vs.
   JSON fallback — since `.env` has Supabase configured, this writes live).
8. Print a one-line confirmation: id, date, meal type, and the saved text.
   If any low/medium-severity privacy issues were found but didn't block
   publish, mention them as a note (matches the web UI's non-blocking
   warning behavior).

### 3. Dashboard compatibility check

Before calling this done, check `src/stats.mjs` and the public board
rendering for any assumption that `publicCaption`/`foods`/`tags` are
non-empty (e.g. does the board skip entries with no caption, or render
blank/broken for one?). If there's a rough edge, use a sane fallback (e.g.
render the raw/redacted text directly when no caption exists) rather than
leaving a broken-looking card — this is part of the same change, not a
follow-up.

## Data model

No schema changes. Uses existing `meals` table columns as-is
(`public_caption`, `foods`, `tags` just end up empty/default for
CLI-logged entries). See `SCHEMA.md`.

## Error handling

- Bad/missing meal type → usage message, exit 1, no write.
- Empty dish text → usage message, exit 1, no write.
- High-severity privacy issue → print flagged issue(s), exit 1, no write.
- Supabase not configured (no `.env` / missing keys) → let `saveMeal`'s
  existing error surface (it already throws when misconfigured); no need to
  special-case this in the CLI.
- Supabase write failure (network/API error) → let the error propagate and
  print it; exit 1.

## Testing

- Unit test for the newly-exported `runPrivacyAgent` (import from
  `src/agentGraph.mjs`, confirm behavior unchanged — it's already covered
  indirectly via existing agent-graph tests, this just confirms the export
  works standalone).
- Unit test(s) for `scripts/log-meal.mjs`'s validation logic: rejects bad
  meal type, rejects empty text, blocks save on high-severity privacy issue,
  builds the correct meal object on success. Structure the script so this
  logic is testable without requiring a live Supabase connection (e.g.
  export the pure argv-parsing/validation/meal-building functions separately
  from the `saveMeal` call, or inject `saveMeal` as a parameter).

Run via existing `npm test` (`node --test test/`).
