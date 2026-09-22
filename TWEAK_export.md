# TWEAK: `npm run export:events` (monthly-events v1)

**Status:** approved in chat 2026-09-22 as part of finishing the `monthly` hub.
**Contract:** `D:\Aru\NYU\monthly\src\monthly\schema\events.v1.json` (v1).

## Why

`monthly` collects one JSONL export per tracker per month. Meals (La Bouchée) is one of
its eight trackers. This is the only Node tracker in the family, so the adapter is a small
script rather than a Python CLI — the contract is the file it writes, not the language.

## Kind

One kind, `meal`, one event per meal whose `date` is in the month:

| field | value |
|---|---|
| `id` | `meal:<id>` |
| `start` | `date` (date-only — a meal record has no clock time) |
| `title` | `redactedText`, never `rawText` |
| `amount` / `unit` | `1`, unit `meals` — a month sums to meals logged |
| `details` | `meal_type`, `cuisine`, `source`, `visibility`, `foods`, `tags`, `comments` (count) |

`redactedText` is used instead of `rawText` on purpose: redaction is this repo's privacy
boundary, and an export that leaves the repo's own guardrail behind would undo it.
`privacyIssues`, `publicCaption`, `photoUrl` and comment text are not exported — the hub
needs counts and content, not the publishing machinery.

## Source of meals

The script calls `readMeals()` from `src/store.mjs`, the same function the server uses, so
it works against Supabase when configured and against `data/meals.json` otherwise. No
second copy of the storage logic.

## Database impact

**None.** The script only reads. No schema change, so `SCHEMA.md` is unchanged.

## CLI

```
node scripts/export-events.mjs --month YYYY-MM --out PATH
```

also wired as `npm run export:events`. It prints the event count and exits non-zero on a
bad month or a write failure, as `monthly collect` expects. Registered in
`monthly/trackers.toml` as `[meals]`, invoking `node` directly (there is no venv here).

## Testing

`node --test` cases in `test/exportEvents.test.mjs`: a meal in the month exports one event
with `meals` as its unit, `rawText` never appears in the output, another month is
excluded, an empty month still writes a valid header, and the header/event shape matches
the contract's required fields.
