import { test } from "node:test";
import assert from "node:assert/strict";
import { runMealAgentGraph } from "../src/agentGraph.mjs";

test("extracts foods and keeps multi-word items intact", async () => {
  const result = await runMealAgentGraph({
    date: "2026-05-01",
    mealType: "breakfast",
    rawText: "bagel with cream cheese and iced coffee"
  });
  assert.equal(result.mealType, "breakfast");
  assert.ok(result.foods.includes("bagel"));
  assert.ok(result.foods.includes("cream cheese"));
  assert.ok(result.foods.includes("iced coffee"));
  assert.ok(result.publicCaption.length > 0);
});

test("redacts an email and blocks publishing on high-severity signals", async () => {
  const result = await runMealAgentGraph({
    rawText: "lunch, reach me at someone@example.com for the recipe"
  });
  assert.ok(result.redactedText.includes("[email]"));
  assert.ok(!result.redactedText.includes("someone@example.com"));
  assert.equal(result.publishable, false);
  assert.ok(result.privacyIssues.some((issue) => issue.label === "email"));
});

test("redacts phone numbers", async () => {
  const result = await runMealAgentGraph({ rawText: "dinner, call 212-555-1234" });
  assert.ok(result.redactedText.includes("[phone]"));
  assert.equal(result.publishable, false);
});

test("infers cuisine from food signals", async () => {
  const result = await runMealAgentGraph({ rawText: "dosa with sambar" });
  assert.equal(result.cuisine, "Indian");
});

test("recognizes skipped meals", async () => {
  const result = await runMealAgentGraph({ mealType: "lunch", rawText: "skipped lunch today" });
  assert.deepEqual(result.foods, []);
  assert.ok(result.tags.includes("skipped"));
});

test("requires raw text", async () => {
  await assert.rejects(() => runMealAgentGraph({ rawText: "   " }), /rawText is required/);
});
