import { test } from "node:test";
import assert from "node:assert/strict";
import { OWNER_ONLY_FIELDS, toPublicMeal, toPublicMeals } from "../src/publicMeal.mjs";

function meal(overrides = {}) {
  return {
    id: "m1",
    date: "2026-05-01",
    mealType: "breakfast",
    visibility: "public",
    rawText: "secret raw — 123 Main St, John Doe",
    redactedText: "redacted",
    privacyIssues: [{ label: "address" }],
    confidence: 0.9,
    publishable: true,
    foods: ["eggs"],
    tags: [],
    cuisine: "Mixed",
    source: "home",
    publicCaption: "Eggs",
    comments: [],
    ...overrides
  };
}

test("toPublicMeal strips every owner-only field but keeps public fields", () => {
  const pub = toPublicMeal(meal());
  for (const field of OWNER_ONLY_FIELDS) {
    assert.equal(field in pub, false, `${field} must not be exposed`);
  }
  assert.equal(pub.publicCaption, "Eggs");
  assert.deepEqual(pub.foods, ["eggs"]);
  assert.equal(pub.id, "m1");
});

test("toPublicMeal does not mutate the source meal", () => {
  const source = meal();
  toPublicMeal(source);
  assert.equal(source.rawText, "secret raw — 123 Main St, John Doe");
});

test("toPublicMeals drops private meals and their raw content entirely", () => {
  const result = toPublicMeals([
    meal({ id: "pub" }),
    meal({ id: "priv", visibility: "private", rawText: "private diary entry" })
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "pub");
  assert.equal(JSON.stringify(result).includes("private diary entry"), false);
  assert.equal(JSON.stringify(result).includes("123 Main St"), false);
});

test("toPublicMeals tolerates non-array input", () => {
  assert.deepEqual(toPublicMeals(undefined), []);
  assert.deepEqual(toPublicMeals(null), []);
});
