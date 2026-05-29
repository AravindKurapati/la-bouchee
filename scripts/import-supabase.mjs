import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isSupabaseConfigured, saveMeal } from "../src/store.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const seedFile = path.join(root, "data", "meals.json");

if (!isSupabaseConfigured()) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

const meals = JSON.parse(await readFile(seedFile, "utf8"));
if (!Array.isArray(meals)) {
  console.error(`${seedFile} must contain a JSON array.`);
  process.exit(1);
}

let imported = 0;
let comments = 0;
for (const meal of meals) {
  await saveMeal(meal);
  imported += 1;
  comments += Array.isArray(meal.comments) ? meal.comments.length : 0;
}

console.log(`Imported ${imported} meals and ${comments} comments into Supabase.`);
