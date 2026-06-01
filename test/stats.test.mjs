import { test } from "node:test";
import assert from "node:assert/strict";
import { computeStats } from "../src/stats.mjs";

function meal(overrides = {}) {
  return {
    id: overrides.id || `m_${Math.random().toString(36).slice(2)}`,
    date: "2026-05-01",
    mealType: "breakfast",
    foods: [],
    tags: [],
    cuisine: "Mixed",
    source: "home",
    visibility: "public",
    publicCaption: "",
    comments: [],
    ...overrides
  };
}

test("empty input yields zeroed stats with a 35-day routine map", () => {
  const stats = computeStats([]);
  assert.equal(stats.totalMeals, 0);
  assert.equal(stats.loggedDays, 0);
  assert.equal(stats.routineMap.length, 35);
});

test("counts meals and logged days, ignoring private meals", () => {
  const stats = computeStats([
    meal({ date: "2026-05-01", mealType: "breakfast", foods: ["eggs"] }),
    meal({ date: "2026-05-01", mealType: "lunch", foods: ["salad"] }),
    meal({ date: "2026-05-02", mealType: "breakfast", foods: ["eggs"] }),
    meal({ date: "2026-05-03", mealType: "dinner", foods: ["secret"], visibility: "private" })
  ]);
  assert.equal(stats.totalMeals, 3);
  assert.equal(stats.loggedDays, 2);
});

test("repeat gravity rises when meals share a food fingerprint", () => {
  const repeated = [
    meal({ date: "2026-05-01", foods: ["oatmeal"] }),
    meal({ date: "2026-05-02", foods: ["oatmeal"] }),
    meal({ date: "2026-05-03", foods: ["oatmeal"] })
  ];
  const varied = [
    meal({ date: "2026-05-01", foods: ["oatmeal"] }),
    meal({ date: "2026-05-02", foods: ["pancakes"] }),
    meal({ date: "2026-05-03", foods: ["waffles"] })
  ];
  assert.ok(computeStats(repeated).repeatGravity > computeStats(varied).repeatGravity);
});

test("top foods are normalized and ranked by count", () => {
  const stats = computeStats([
    meal({ foods: ["Eggs"] }),
    meal({ date: "2026-05-02", foods: ["eggs"] }),
    meal({ date: "2026-05-03", foods: ["toast"] })
  ]);
  assert.equal(stats.topFoods[0].label, "eggs");
  assert.equal(stats.topFoods[0].count, 2);
});

test("skipped meals are counted but excluded from repeat gravity", () => {
  // Two same-type skipped days must NOT register as a familiar repeat. This
  // keeps repeatGravity consistent with buildRoutineMap, which also ignores
  // skipped meals when counting repeats.
  const stats = computeStats([
    meal({ date: "2026-05-01", foods: [], tags: ["skipped"], source: "skipped" }),
    meal({ date: "2026-05-02", foods: [], tags: ["skipped"], source: "skipped" })
  ]);
  assert.equal(stats.skippedCount, 2);
  assert.equal(stats.repeatGravity, 0);
});

test("skipped meals do not dilute repeat gravity of real repeats", () => {
  const stats = computeStats([
    meal({ date: "2026-05-01", foods: ["oatmeal"] }),
    meal({ date: "2026-05-02", foods: ["oatmeal"] }),
    meal({ date: "2026-05-03", foods: [], tags: ["skipped"], source: "skipped" })
  ]);
  // 2 real meals, 1 unique fingerprint => 50% over the 2 non-skipped meals.
  assert.equal(stats.repeatGravity, 50);
});

test("comments are flattened into recentComments", () => {
  const stats = computeStats([
    meal({
      id: "m1",
      foods: ["eggs"],
      comments: [
        { id: "c1", createdAt: "2026-05-01T10:00:00Z", name: "Ada", text: "yum" }
      ]
    })
  ]);
  assert.equal(stats.commentCount, 1);
  assert.equal(stats.recentComments[0].text, "yum");
  assert.equal(stats.recentComments[0].mealId, "m1");
});
