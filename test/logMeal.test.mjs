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
