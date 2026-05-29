import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dataDir = path.join(root, "data");
const dataFile = path.join(dataDir, "meals.json");

let supabaseClient;

export function isSupabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function getSupabase() {
  if (!isSupabaseConfigured()) return null;
  if (!supabaseClient) {
    supabaseClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }
  return supabaseClient;
}

function withStatus(error, statusCode) {
  error.statusCode = statusCode;
  return error;
}

function cleanPublicText(value, maxLength) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function appCommentFromRow(row) {
  return {
    id: row.id,
    createdAt: row.created_at,
    name: row.name || "friend",
    text: row.text || ""
  };
}

function appMealFromRow(row) {
  const comments = Array.isArray(row.comments) ? row.comments : [];
  return {
    id: row.id,
    createdAt: row.created_at,
    visibility: row.visibility || "public",
    date: row.date,
    mealType: row.meal_type,
    rawText: row.raw_text || "",
    redactedText: row.redacted_text || "",
    foods: Array.isArray(row.foods) ? row.foods : [],
    tags: Array.isArray(row.tags) ? row.tags : [],
    cuisine: row.cuisine || "Mixed",
    source: row.source || "unknown",
    photoUrl: row.photo_url || "",
    confidence: Number(row.confidence || 0),
    privacyIssues: Array.isArray(row.privacy_issues) ? row.privacy_issues : [],
    publishable: row.publishable !== false,
    publicCaption: row.public_caption || "",
    comments: comments.map(appCommentFromRow).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
  };
}

function normalizeMeal(meal) {
  return {
    id: meal.id || `meal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: meal.createdAt || new Date().toISOString(),
    visibility: meal.visibility || "public",
    date: meal.date,
    mealType: meal.mealType,
    rawText: meal.rawText || "",
    redactedText: meal.redactedText || "",
    foods: Array.isArray(meal.foods) ? meal.foods : [],
    tags: Array.isArray(meal.tags) ? meal.tags : [],
    cuisine: meal.cuisine || "Mixed",
    source: meal.source || "unknown",
    photoUrl: meal.photoUrl || "",
    confidence: Number(meal.confidence || 0),
    privacyIssues: Array.isArray(meal.privacyIssues) ? meal.privacyIssues : [],
    publishable: meal.publishable !== false,
    publicCaption: meal.publicCaption || "",
    comments: Array.isArray(meal.comments) ? meal.comments : undefined
  };
}

function mealRowFromApp(meal) {
  return {
    id: meal.id,
    created_at: meal.createdAt,
    visibility: meal.visibility,
    date: meal.date,
    meal_type: meal.mealType,
    raw_text: meal.rawText,
    redacted_text: meal.redactedText,
    foods: meal.foods,
    tags: meal.tags,
    cuisine: meal.cuisine,
    source: meal.source,
    photo_url: meal.photoUrl,
    confidence: meal.confidence,
    privacy_issues: meal.privacyIssues,
    publishable: meal.publishable,
    public_caption: meal.publicCaption
  };
}

function commentRowFromApp(mealId, comment) {
  return {
    id: comment.id || `comment_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    meal_id: mealId,
    created_at: comment.createdAt || new Date().toISOString(),
    name: cleanPublicText(comment.name, 28) || "friend",
    text: cleanPublicText(comment.text, 180)
  };
}

async function readFileMeals() {
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

async function writeFileMeals(meals) {
  if (process.env.VERCEL && process.env.ALLOW_FILE_STORE_WRITES !== "1") {
    throw withStatus(new Error("Persistent writes are not configured on this deployment yet."), 501);
  }
  await mkdir(dataDir, { recursive: true });
  await writeFile(dataFile, `${JSON.stringify(meals, null, 2)}\n`);
}

async function readSupabaseMealById(id) {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("meals").select("*, comments(*)").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? appMealFromRow(data) : null;
}

async function readSupabaseMeals() {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("meals").select("*, comments(*)").order("date", { ascending: true });
  if (error) throw error;
  return (data || []).map(appMealFromRow);
}

async function saveSupabaseMeal(meal) {
  const supabase = getSupabase();
  const nextMeal = normalizeMeal(meal);
  const { error } = await supabase.from("meals").upsert(mealRowFromApp(nextMeal), { onConflict: "id" });
  if (error) throw error;

  if (Array.isArray(nextMeal.comments)) {
    const deleteResult = await supabase.from("comments").delete().eq("meal_id", nextMeal.id);
    if (deleteResult.error) throw deleteResult.error;

    const commentRows = nextMeal.comments
      .map((comment) => commentRowFromApp(nextMeal.id, comment))
      .filter((comment) => comment.text);
    if (commentRows.length) {
      const insertResult = await supabase.from("comments").insert(commentRows);
      if (insertResult.error) throw insertResult.error;
    }
  }

  return (await readSupabaseMealById(nextMeal.id)) || { ...nextMeal, comments: nextMeal.comments || [] };
}

async function deleteSupabaseMeal(id) {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("meals").delete().eq("id", id).select("id");
  if (error) throw error;
  return Boolean(data?.length);
}

async function addSupabaseComment(mealId, input) {
  const supabase = getSupabase();
  const meal = await readSupabaseMealById(mealId);
  if (!meal || meal.visibility === "private") throw withStatus(new Error("Meal not found"), 404);

  const comment = commentRowFromApp(mealId, input);
  if (!comment.text) throw withStatus(new Error("Comment text is required"), 400);

  const { data, error } = await supabase.from("comments").insert(comment).select("*").single();
  if (error) throw error;
  return {
    meal: (await readSupabaseMealById(mealId)) || meal,
    comment: appCommentFromRow(data)
  };
}

export async function readMeals() {
  return isSupabaseConfigured() ? readSupabaseMeals() : readFileMeals();
}

export async function writeMeals(meals) {
  if (isSupabaseConfigured()) {
    throw withStatus(new Error("Bulk meal replacement is not supported for the Supabase store."), 501);
  }
  await writeFileMeals(meals);
}

export async function saveMeal(meal) {
  if (isSupabaseConfigured()) return saveSupabaseMeal(meal);

  const meals = await readFileMeals();
  const nextMeal = normalizeMeal(meal);
  nextMeal.comments = nextMeal.comments || [];
  const existingIndex = meals.findIndex((item) => item.id === nextMeal.id);
  if (existingIndex >= 0) meals[existingIndex] = nextMeal;
  else meals.push(nextMeal);
  await writeFileMeals(meals);
  return nextMeal;
}

export async function deleteMeal(id) {
  if (isSupabaseConfigured()) return deleteSupabaseMeal(id);

  const meals = await readFileMeals();
  const nextMeals = meals.filter((meal) => meal.id !== id);
  await writeFileMeals(nextMeals);
  return meals.length !== nextMeals.length;
}

export async function addComment(mealId, input) {
  if (isSupabaseConfigured()) return addSupabaseComment(mealId, input);

  const meals = await readFileMeals();
  const meal = meals.find((item) => item.id === mealId && item.visibility !== "private");
  if (!meal) throw withStatus(new Error("Meal not found"), 404);

  const name = cleanPublicText(input.name, 28) || "friend";
  const text = cleanPublicText(input.text, 180);
  if (!text) throw withStatus(new Error("Comment text is required"), 400);

  const comment = {
    id: `comment_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    name,
    text
  };

  meal.comments = Array.isArray(meal.comments) ? meal.comments : [];
  meal.comments.push(comment);
  await writeFileMeals(meals);
  return { meal, comment };
}
