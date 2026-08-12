# CLI Meal Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `npm run log <mealType> "<dish text>"` — a one-shot terminal command that privacy-checks a meal entry and saves it directly to the live Supabase store as a public meal, without going through the web UI or the full agent pipeline.

**Architecture:** Export the existing `runPrivacyAgent` function from `src/agentGraph.mjs` so it can be called standalone. Add a new `scripts/log-meal.mjs` that parses argv, validates input, runs the privacy check, builds a meal object, and calls the existing `saveMeal` from `src/store.mjs` (which already picks Supabase vs. JSON fallback based on env). Wire it up as an `npm run log` script using the same `--env-file=.env` pattern as `scripts/create-owner.mjs`.

**Tech Stack:** Node.js (ESM, `node:test` for tests), existing `src/store.mjs` / `src/agentGraph.mjs` modules, `@supabase/supabase-js` (already a dependency).

## Global Constraints

- No interactive prompt mode — one-shot args only: `npm run log <mealType> "<dish text>"`.
- `mealType` must be one of `pre-breakfast | breakfast | lunch | dinner`; anything else is rejected.
- No CLI auth flow — script reads `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` from `.env` via `--env-file=.env`, same as `scripts/create-owner.mjs`.
- High-severity privacy issues block the save entirely (no partial/silent publish).
- No schema changes — use existing `meals` table columns as-is (see `SCHEMA.md`).
- No editing/deleting from the CLI; that stays in the web UI.
- No photo, custom date, or private-visibility support in this version — date is always today, visibility is always `"public"`.

---

### Task 1: Export `runPrivacyAgent` from `src/agentGraph.mjs`

**Files:**
- Modify: `src/agentGraph.mjs:156` (the `function runPrivacyAgent(rawText) {` declaration)
- Test: `test/agentGraph.test.mjs`

**Interfaces:**
- Produces: `export function runPrivacyAgent(rawText: string): { issues: Array<{label: string, severity: "high"|"medium"|"low", detail: string}>, redactedText: string, publishable: boolean }` — importable from `src/agentGraph.mjs`.

- [ ] **Step 1: Write the failing test**

Add to `test/agentGraph.test.mjs` (add the import alongside the existing one):

```js
import { runMealAgentGraph, runPrivacyAgent } from "../src/agentGraph.mjs";
```

Add this test at the end of the file:

```js
test("runPrivacyAgent is exported and usable standalone", () => {
  const result = runPrivacyAgent("lunch with someone@example.com");
  assert.ok(result.redactedText.includes("[email]"));
  assert.equal(result.publishable, false);
  assert.ok(result.issues.some((issue) => issue.label === "email"));
});

test("runPrivacyAgent returns publishable true for clean text", () => {
  const result = runPrivacyAgent("eggs and toast");
  assert.equal(result.publishable, true);
  assert.deepEqual(result.issues, []);
  assert.equal(result.redactedText, "eggs and toast");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `runPrivacyAgent` is not exported from `../src/agentGraph.mjs` (import will be `undefined`, causing a TypeError when called).

- [ ] **Step 3: Change the function declaration to an export**

In `src/agentGraph.mjs`, change line 156 from:

```js
function runPrivacyAgent(rawText) {
```

to:

```js
export function runPrivacyAgent(rawText) {
```

No other changes to the function body. The internal call site in `privacyNode` (around line 276) is unaffected since it's in the same module.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — all tests including the two new ones.

- [ ] **Step 5: Commit**

```bash
git add src/agentGraph.mjs test/agentGraph.test.mjs
git commit -m "Export runPrivacyAgent for standalone use outside the LangGraph pipeline"
```

---

### Task 2: `scripts/log-meal.mjs` with testable pure functions

**Files:**
- Create: `scripts/log-meal.mjs`
- Test: `test/logMeal.test.mjs`

**Interfaces:**
- Consumes: `runPrivacyAgent(rawText: string)` from `src/agentGraph.mjs` (Task 1). `saveMeal(meal: object): Promise<object>` from `src/store.mjs` (existing, unchanged).
- Produces (all named exports from `scripts/log-meal.mjs`, used by the test file and by the script's own CLI entrypoint):
  - `MEAL_TYPES: string[]` — `["pre-breakfast", "breakfast", "lunch", "dinner"]`
  - `parseArgs(argv: string[]): { mealType: string, rawText: string }` — throws `Error` with a usage message if `argv` has fewer than 2 elements.
  - `validateMealType(mealType: string): void` — throws `Error` if not in `MEAL_TYPES`.
  - `buildMeal({ mealType: string, rawText: string, privacy: { redactedText: string, issues: array, publishable: boolean } }): object` — returns the full meal object ready for `saveMeal`.
  - `logMeal({ argv: string[], runPrivacyAgent: function, saveMeal: function }): Promise<{ ok: boolean, meal?: object, issues?: array, message: string }>` — the orchestration function, with `runPrivacyAgent`/`saveMeal` injected so tests don't need a live Supabase connection.

- [ ] **Step 1: Write the failing tests**

Create `test/logMeal.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseArgs, validateMealType, buildMeal, logMeal, MEAL_TYPES } from "../scripts/log-meal.mjs";

test("parseArgs splits mealType from the rest as rawText", () => {
  const result = parseArgs(["breakfast", "eggs", "and", "toast"]);
  assert.deepEqual(result, { mealType: "breakfast", rawText: "eggs and toast" });
});

test("parseArgs throws when fewer than 2 args are given", () => {
  assert.throws(() => parseArgs(["breakfast"]), /Usage:/);
  assert.throws(() => parseArgs([]), /Usage:/);
});

test("validateMealType accepts all known meal types", () => {
  for (const mealType of MEAL_TYPES) {
    assert.doesNotThrow(() => validateMealType(mealType));
  }
});

test("validateMealType rejects unknown meal types", () => {
  assert.throws(() => validateMealType("brunch"), /pre-breakfast \| breakfast \| lunch \| dinner/);
});

test("buildMeal sets public caption to the redacted text and today's date", () => {
  const meal = buildMeal({
    mealType: "lunch",
    rawText: "ramen and gyoza",
    privacy: { redactedText: "ramen and gyoza", issues: [], publishable: true }
  });
  assert.equal(meal.mealType, "lunch");
  assert.equal(meal.rawText, "ramen and gyoza");
  assert.equal(meal.redactedText, "ramen and gyoza");
  assert.equal(meal.publicCaption, "ramen and gyoza");
  assert.equal(meal.visibility, "public");
  assert.equal(meal.date, new Date().toISOString().slice(0, 10));
  assert.deepEqual(meal.foods, []);
  assert.deepEqual(meal.tags, []);
  assert.equal(meal.cuisine, "Mixed");
  assert.equal(meal.source, "unknown");
  assert.equal(meal.publishable, true);
});

test("logMeal rejects bad meal type without calling saveMeal", async () => {
  let saveCalled = false;
  const result = await logMeal({
    argv: ["brunch", "eggs"],
    runPrivacyAgent: () => ({ redactedText: "eggs", issues: [], publishable: true }),
    saveMeal: async () => { saveCalled = true; }
  });
  assert.equal(result.ok, false);
  assert.match(result.message, /pre-breakfast \| breakfast \| lunch \| dinner/);
  assert.equal(saveCalled, false);
});

test("logMeal rejects empty dish text without calling saveMeal", async () => {
  let saveCalled = false;
  const result = await logMeal({
    argv: ["breakfast"],
    runPrivacyAgent: () => ({ redactedText: "", issues: [], publishable: true }),
    saveMeal: async () => { saveCalled = true; }
  });
  assert.equal(result.ok, false);
  assert.match(result.message, /Usage:/);
  assert.equal(saveCalled, false);
});

test("logMeal blocks save when privacy agent finds a high-severity issue", async () => {
  let saveCalled = false;
  const result = await logMeal({
    argv: ["lunch", "reach", "me", "at", "someone@example.com"],
    runPrivacyAgent: () => ({
      redactedText: "reach me at [email]",
      issues: [{ label: "email", severity: "high", detail: "Detected email" }],
      publishable: false
    }),
    saveMeal: async () => { saveCalled = true; }
  });
  assert.equal(result.ok, false);
  assert.deepEqual(result.issues, [{ label: "email", severity: "high", detail: "Detected email" }]);
  assert.equal(saveCalled, false);
});

test("logMeal saves and returns the meal on success", async () => {
  const savedMeals = [];
  const result = await logMeal({
    argv: ["dinner", "ramen"],
    runPrivacyAgent: () => ({ redactedText: "ramen", issues: [], publishable: true }),
    saveMeal: async (meal) => {
      savedMeals.push(meal);
      return { ...meal, id: "meal_test_123" };
    }
  });
  assert.equal(result.ok, true);
  assert.equal(result.meal.id, "meal_test_123");
  assert.equal(savedMeals.length, 1);
  assert.equal(savedMeals[0].mealType, "dinner");
});

test("logMeal reports non-blocking (low/medium) privacy issues but still saves", async () => {
  const result = await logMeal({
    argv: ["lunch", "tacos", "for", "$12"],
    runPrivacyAgent: () => ({
      redactedText: "tacos for [price]",
      issues: [{ label: "exact price", severity: "low", detail: "Detected exact price" }],
      publishable: true
    }),
    saveMeal: async (meal) => ({ ...meal, id: "meal_test_456" })
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.issues, [{ label: "exact price", severity: "low", detail: "Detected exact price" }]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `scripts/log-meal.mjs` does not exist yet, so the import fails.

- [ ] **Step 3: Write `scripts/log-meal.mjs`**

```js
import { runPrivacyAgent } from "../src/agentGraph.mjs";
import { saveMeal } from "../src/store.mjs";

export const MEAL_TYPES = ["pre-breakfast", "breakfast", "lunch", "dinner"];

const USAGE = 'Usage: npm run log <pre-breakfast|breakfast|lunch|dinner> "<dish text>"';

export function parseArgs(argv) {
  if (argv.length < 2) throw new Error(USAGE);
  const [mealType, ...rest] = argv;
  const rawText = rest.join(" ").trim();
  if (!rawText) throw new Error(USAGE);
  return { mealType, rawText };
}

export function validateMealType(mealType) {
  if (!MEAL_TYPES.includes(mealType)) {
    throw new Error(`Invalid meal type "${mealType}". Must be one of: ${MEAL_TYPES.join(" | ")}`);
  }
}

export function buildMeal({ mealType, rawText, privacy }) {
  return {
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
    publicCaption: privacy.redactedText,
    visibility: "public"
  };
}

export async function logMeal({ argv, runPrivacyAgent: runPrivacy, saveMeal: save }) {
  let mealType;
  let rawText;
  try {
    ({ mealType, rawText } = parseArgs(argv));
    validateMealType(mealType);
  } catch (error) {
    return { ok: false, message: error.message };
  }

  const privacy = runPrivacy(rawText);
  if (!privacy.publishable) {
    return { ok: false, issues: privacy.issues, message: "Blocked: high-severity privacy issue detected." };
  }

  const meal = buildMeal({ mealType, rawText, privacy });
  const saved = await save(meal);
  return { ok: true, meal: saved, issues: privacy.issues, message: "Saved." };
}

async function main() {
  const result = await logMeal({ argv: process.argv.slice(2), runPrivacyAgent, saveMeal });

  if (!result.ok) {
    if (result.issues) {
      console.error("Not saved — privacy issue detected:");
      for (const issue of result.issues) console.error(`  [${issue.severity}] ${issue.label}: ${issue.detail}`);
    } else {
      console.error(result.message);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Saved: ${result.meal.mealType} on ${result.meal.date} (id: ${result.meal.id})`);
  console.log(`  ${result.meal.publicCaption}`);
  if (result.issues?.length) {
    console.log("Note — non-blocking privacy signals:");
    for (const issue of result.issues) console.log(`  [${issue.severity}] ${issue.label}: ${issue.detail}`);
  }
}

const isDirectRun = process.argv[1] && import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}`;
if (isDirectRun) {
  main().catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  });
}
```

Note on the `isDirectRun` check: this repo runs on Windows (backslash paths), so the plain `import.meta.url === \`file://${process.argv[1]}\`` comparison used elsewhere would fail on Windows paths — the manual slash replacement handles that. This mirrors the need to keep `main()` from auto-running under `node --test`, which imports the module without invoking it as the entrypoint.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — all tests including the new ones in `test/logMeal.test.mjs`. Confirm no test triggers `main()` (it shouldn't, since `node --test` imports the file rather than running it as `node scripts/log-meal.mjs` directly).

- [ ] **Step 5: Commit**

```bash
git add scripts/log-meal.mjs test/logMeal.test.mjs
git commit -m "Add scripts/log-meal.mjs for one-shot CLI meal logging"
```

---

### Task 3: Wire up `npm run log` and document it

**Files:**
- Modify: `package.json:6-12` (the `"scripts"` block)
- Modify: `README.md` (add a short section near "Log Meals")

**Interfaces:**
- Consumes: `scripts/log-meal.mjs` (Task 2), run as a CLI entrypoint via `node --env-file=.env scripts/log-meal.mjs`.
- Produces: `npm run log <mealType> "<dish text>"` command usable from the repo root.

- [ ] **Step 1: Add the npm script**

In `package.json`, add `"log"` to the `"scripts"` object (matches the existing `"create:owner"` pattern):

```json
  "scripts": {
    "dev": "node server.mjs",
    "import:supabase": "node scripts/import-supabase.mjs",
    "create:owner": "node scripts/create-owner.mjs",
    "log": "node --env-file=.env scripts/log-meal.mjs",
    "start": "node server.mjs",
    "test": "node --test test/"
  },
```

- [ ] **Step 2: Verify it fails cleanly with no args**

Run: `npm run log`
Expected: prints the usage message (`Usage: npm run log <pre-breakfast|breakfast|lunch|dinner> "<dish text>"`) and exits non-zero. (If `.env` doesn't exist locally, `--env-file=.env` on Node 20+ still runs fine as long as validation fails before any Supabase call — confirm the usage error fires before any Supabase access is attempted.)

- [ ] **Step 3: Manual smoke test against your local `.env`**

Run: `npm run log breakfast "eggs and toast"`
Expected: prints `Saved: breakfast on <today's date> (id: meal_...)` followed by the caption line. Then check the live dashboard (or query Supabase directly) to confirm the entry appears as a public meal with `publicCaption` equal to the redacted text and empty `foods`/`tags`.

This step needs your local `.env` with `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` configured — skip the live-write portion if you'd rather verify against a test project first, but do confirm the usage/validation errors (Step 2) at minimum.

- [ ] **Step 4: Add a README section**

In `README.md`, after the existing "## Log Meals" section (ends around line 26), add:

```markdown
### Quick CLI Logging

For a fast personal log without opening the browser:

```bash
npm run log breakfast "eggs and toast"
```

This runs only the privacy check (not the full parser/tagger/caption agents) and saves
directly as a public meal — it requires `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` in
your local `.env` since it writes straight to Supabase, bypassing the owner-auth HTTP
flow. If the privacy check finds a high-severity issue (email, phone, address), the
entry is not saved.
```

- [ ] **Step 5: Commit**

```bash
git add package.json README.md
git commit -m "Wire up npm run log and document CLI meal logging"
```

---

## Self-Review Notes

- **Spec coverage:** privacy-only pipeline (Task 1+2), one-shot argv command (Task 2+3), direct Supabase write via existing `saveMeal` (Task 2), high-severity block (Task 2), dashboard compatibility (`publicCaption` set to redacted text in `buildMeal`, avoiding the `public/app.js:254` "Skipped" fallback bug), testability without live Supabase (dependency injection in `logMeal`), README/doc update (Task 3) — all covered.
- **Placeholder scan:** no TBD/TODO; all steps have literal code.
- **Type consistency:** `runPrivacyAgent(rawText)` return shape (`{issues, redactedText, publishable}`) matches between Task 1's export and Task 2's usage. `saveMeal(meal)` signature matches existing `src/store.mjs` usage (takes an app-shape meal object, same fields as `normalizeMeal` expects). `logMeal`'s injected `runPrivacyAgent`/`saveMeal` parameter names match the real function names imported in `main()`.
