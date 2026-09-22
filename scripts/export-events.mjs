#!/usr/bin/env node
/**
 * monthly-events v1 export: one `meal` event per logged meal.
 *
 * Titles use redactedText, never rawText — redaction is this repo's privacy boundary.
 * See TWEAK_export.md.
 */
import fs from "node:fs/promises";
import path from "node:path";
// src/store.mjs pulls in the Supabase client, so it is imported inside main() —
// the pure builders below stay testable without installing runtime deps.

export const TRACKER = "meals";
export const KINDS = ["meal"];

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function buildEvents(meals, month) {
  return meals
    .filter((meal) => typeof meal?.date === "string" && meal.date.slice(0, 7) === month)
    .sort((a, b) => (a.date === b.date ? String(a.id).localeCompare(String(b.id))
                                       : a.date.localeCompare(b.date)))
    .map((meal) => {
      const details = {};
      if (meal.mealType) details.meal_type = meal.mealType;
      if (meal.cuisine) details.cuisine = meal.cuisine;
      if (meal.source) details.source = meal.source;
      if (meal.visibility) details.visibility = meal.visibility;
      if (Array.isArray(meal.foods) && meal.foods.length) details.foods = meal.foods;
      if (Array.isArray(meal.tags) && meal.tags.length) details.tags = meal.tags;
      if (Array.isArray(meal.comments) && meal.comments.length) {
        details.comments = meal.comments.length;
      }
      return {
        id: `meal:${meal.id}`,
        tracker: TRACKER,
        kind: "meal",
        start: meal.date,
        end: null,
        title: meal.redactedText || null,
        amount: 1,
        unit: "meals",
        place: null,
        details
      };
    });
}

export function buildFile(meals, month) {
  const header = {
    schema: "monthly-events",
    version: 1,
    tracker: TRACKER,
    month,
    exported_at: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    kinds: KINDS
  };
  const events = buildEvents(meals, month);
  return { text: [header, ...events].map((x) => JSON.stringify(x)).join("\n") + "\n",
           count: events.length };
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, "");
    if (key) args[key] = argv[i + 1];
  }
  return args;
}

async function main() {
  const { month, out } = parseArgs(process.argv.slice(2));
  if (!month || !MONTH_RE.test(month)) {
    console.error(`--month must be YYYY-MM, got ${month ?? "(nothing)"}`);
    process.exit(2);
  }
  if (!out) {
    console.error("--out is required");
    process.exit(2);
  }
  const { readMeals } = await import("../src/store.mjs");
  const meals = await readMeals();
  const { text, count } = buildFile(meals, month);
  await fs.mkdir(path.dirname(path.resolve(out)), { recursive: true });
  await fs.writeFile(out, text, "utf8");
  console.log(count);
}

if (import.meta.url === `file://${process.argv[1]}` ||
    process.argv[1]?.endsWith("export-events.mjs")) {
  main().catch((error) => {
    console.error(error?.message || error);
    process.exit(1);
  });
}
