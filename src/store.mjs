import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dataDir = path.join(root, "data");
const dataFile = path.join(dataDir, "meals.json");

export async function readMeals() {
  try {
    const raw = await readFile(dataFile, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    await mkdir(dataDir, { recursive: true });
    await writeFile(dataFile, "[]\n");
    return [];
  }
}

export async function writeMeals(meals) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(dataFile, `${JSON.stringify(meals, null, 2)}\n`);
}

export async function saveMeal(meal) {
  const meals = await readMeals();
  const nextMeal = {
    id: meal.id || `meal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: meal.createdAt || new Date().toISOString(),
    visibility: meal.visibility || "public",
    ...meal,
    comments: Array.isArray(meal.comments) ? meal.comments : []
  };
  const existingIndex = meals.findIndex((item) => item.id === nextMeal.id);
  if (existingIndex >= 0) meals[existingIndex] = nextMeal;
  else meals.push(nextMeal);
  await writeMeals(meals);
  return nextMeal;
}

export async function deleteMeal(id) {
  const meals = await readMeals();
  const nextMeals = meals.filter((meal) => meal.id !== id);
  await writeMeals(nextMeals);
  return meals.length !== nextMeals.length;
}

function cleanPublicText(value, maxLength) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export async function addComment(mealId, input) {
  const meals = await readMeals();
  const meal = meals.find((item) => item.id === mealId && item.visibility !== "private");
  if (!meal) throw new Error("Meal not found");

  const name = cleanPublicText(input.name, 28) || "friend";
  const text = cleanPublicText(input.text, 180);
  if (!text) throw new Error("Comment text is required");

  const comment = {
    id: `comment_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    name,
    text
  };

  meal.comments = Array.isArray(meal.comments) ? meal.comments : [];
  meal.comments.push(comment);
  await writeMeals(meals);
  return { meal, comment };
}
