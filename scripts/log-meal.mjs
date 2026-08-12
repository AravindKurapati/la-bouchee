import { runPrivacyAgent, MEAL_TYPES } from "../src/agentGraph.mjs";
import { saveMeal } from "../src/store.mjs";

export { MEAL_TYPES };

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

// On Windows, process.argv[1] is a bare path like "D:\...\file.mjs". Building
// "file://${path}" would only produce a 2-slash URL, which never equals Node's
// real 3-slash import.meta.url ("file:///D:/..."), so a strict === check would
// always fail there. Using endsWith() on the normalized path instead correctly
// detects direct-run on all platforms.
const isDirectRun = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"));
if (isDirectRun) {
  main().catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  });
}
