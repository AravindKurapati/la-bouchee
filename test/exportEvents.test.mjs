import { test } from "node:test";
import assert from "node:assert/strict";
import { buildEvents, buildFile } from "../scripts/export-events.mjs";

function meal(overrides = {}) {
  return {
    id: "m1",
    date: "2026-09-04",
    mealType: "lunch",
    rawText: "chicken rice with Priya at her place",
    redactedText: "chicken rice",
    foods: ["chicken rice"],
    tags: ["protein", "carb"],
    cuisine: "Indian",
    source: "home",
    visibility: "public",
    publicCaption: "chicken rice",
    privacyIssues: [{ severity: "high", kind: "person" }],
    comments: [],
    ...overrides
  };
}

test("a meal in the month becomes one meal event", () => {
  const [event] = buildEvents([meal()], "2026-09");
  assert.equal(event.id, "meal:m1");
  assert.equal(event.kind, "meal");
  assert.equal(event.start, "2026-09-04");
  assert.equal(event.amount, 1);
  assert.equal(event.unit, "meals");
  assert.equal(event.title, "chicken rice");
  assert.deepEqual(event.details, {
    meal_type: "lunch", cuisine: "Indian", source: "home", visibility: "public",
    foods: ["chicken rice"], tags: ["protein", "carb"]
  });
});

test("raw text and privacy issues never reach the export", () => {
  const { text } = buildFile([meal()], "2026-09");
  assert.ok(!text.includes("Priya"));
  assert.ok(!text.includes("privacyIssues"));
});

test("other months are excluded", () => {
  const meals = [meal({ id: "m1", date: "2026-08-31" }),
                 meal({ id: "m2", date: "2026-09-01" })];
  const events = buildEvents(meals, "2026-09");
  assert.equal(events.length, 1);
  assert.equal(events[0].id, "meal:m2");
});

test("an empty month still writes a valid header line", () => {
  const { text, count } = buildFile([], "2026-01");
  assert.equal(count, 0);
  const lines = text.trim().split("\n");
  assert.equal(lines.length, 1);
  const header = JSON.parse(lines[0]);
  assert.equal(header.schema, "monthly-events");
  assert.equal(header.version, 1);
  assert.equal(header.tracker, "meals");
  assert.equal(header.month, "2026-01");
  assert.deepEqual(header.kinds, ["meal"]);
  assert.match(header.exported_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
});

test("events are sorted by date then id, and comments are counted", () => {
  const meals = [
    meal({ id: "b", date: "2026-09-05", comments: [{ id: "c1" }, { id: "c2" }] }),
    meal({ id: "a", date: "2026-09-05" }),
    meal({ id: "c", date: "2026-09-02" })
  ];
  const events = buildEvents(meals, "2026-09");
  assert.deepEqual(events.map((e) => e.id), ["meal:c", "meal:a", "meal:b"]);
  assert.equal(events[2].details.comments, 2);
});

test("a meal with no redacted text exports a null title", () => {
  const [event] = buildEvents([meal({ redactedText: "" })], "2026-09");
  assert.equal(event.title, null);
});
