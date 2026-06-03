import { toPublicMeal } from "./publicMeal.mjs";

const MEAL_ORDER = ["pre-breakfast", "breakfast", "lunch", "dinner"];

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function dateFromIso(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function isoFromDate(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(iso, days) {
  const date = dateFromIso(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return isoFromDate(date);
}

function daysBetween(startIso, endIso) {
  return Math.round((dateFromIso(endIso) - dateFromIso(startIso)) / 86400000);
}

function countBy(items) {
  const counts = new Map();
  for (const item of items.filter(Boolean)) counts.set(item, (counts.get(item) || 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([label, count]) => ({ label, count }));
}

function percent(value, total) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function displayLabel(label) {
  return String(label || "").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function routineStateFor(repeatCount) {
  if (repeatCount >= 3) return "routine";
  if (repeatCount === 2) return "familiar";
  return "new";
}

function buildRoutineMap(meals, endIso) {
  const byDayMeal = new Map();
  for (const meal of meals) byDayMeal.set(`${meal.date}:${meal.mealType}`, meal);

  const fingerprintCounts = new Map();
  for (const meal of meals) {
    if (meal.tags?.includes("skipped") || meal.source === "skipped") continue;
    const fingerprint = mealFingerprint(meal);
    fingerprintCounts.set(fingerprint, (fingerprintCounts.get(fingerprint) || 0) + 1);
  }
  const maxRepeat = Math.max(1, ...fingerprintCounts.values());

  return Array.from({ length: 35 }, (_, index) => {
    const date = addDays(endIso, index - 34);
    const cells = Object.fromEntries(
      MEAL_ORDER.map((mealType) => {
        const meal = byDayMeal.get(`${date}:${mealType}`);
        if (!meal) {
          return [
            mealType,
            {
              state: "empty",
              source: "unknown",
              repeatCount: 0,
              frequency: 0,
              commentCount: 0,
              label: "No public entry"
            }
          ];
        }

        const commentCount = Array.isArray(meal.comments) ? meal.comments.length : 0;
        if (meal.tags?.includes("skipped") || meal.source === "skipped") {
          return [
            mealType,
            {
              state: "skipped",
              source: "skipped",
              repeatCount: 0,
              frequency: 0,
              commentCount,
              label: meal.publicCaption || "Skipped"
            }
          ];
        }

        const fingerprint = mealFingerprint(meal);
        const repeatCount = fingerprintCounts.get(fingerprint) || 1;
        return [
          mealType,
          {
            state: routineStateFor(repeatCount),
            source: meal.source || "unknown",
            repeatCount,
            frequency: percent(repeatCount, maxRepeat),
            commentCount,
            label: meal.publicCaption || (meal.foods || []).join(", ") || "Logged meal"
          }
        ];
      })
    );
    return {
      date,
      weekday: dateFromIso(date).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
      cells
    };
  });
}

function mealFingerprint(meal) {
  return (meal.foods || []).map(normalize).sort().join("|") || `${meal.mealType}:skipped`;
}

function buildDigest({ meals, topFoods, topTags, topCuisines, loggedDays }) {
  if (!meals.length) return "No public meals yet. The first entry will start the signal.";

  const anchors = [];
  if (topFoods[0]) anchors.push(`${displayLabel(topFoods[0].label)} is the current gravity well`);
  if (topCuisines[0]) anchors.push(`${displayLabel(topCuisines[0].label)} is the dominant cuisine`);
  if (topTags[0]) anchors.push(`${displayLabel(topTags[0].label)} is the dominant tag`);
  anchors.push(`${loggedDays} public day${loggedDays === 1 ? "" : "s"} logged`);
  return anchors.join(". ") + ".";
}

function flattenComments(meals) {
  return meals
    .flatMap((meal) =>
      (Array.isArray(meal.comments) ? meal.comments : []).map((comment) => ({
        id: comment.id,
        createdAt: comment.createdAt,
        name: comment.name || "friend",
        text: comment.text || "",
        mealId: meal.id,
        mealDate: meal.date,
        mealType: meal.mealType,
        mealCaption: meal.publicCaption || ""
      }))
    )
    .filter((comment) => comment.text)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export function computeStats(mealsInput) {
  const meals = [...mealsInput].sort((a, b) => `${a.date}:${a.mealType}`.localeCompare(`${b.date}:${b.mealType}`));
  const visibleMeals = meals.filter((meal) => meal.visibility !== "private");
  const totalMeals = visibleMeals.length;
  const daySet = new Set(visibleMeals.map((meal) => meal.date));
  const loggedDays = daySet.size;
  const todayIso = new Date().toISOString().slice(0, 10);
  const firstDate = visibleMeals[0]?.date || todayIso;
  const lastDate = visibleMeals.at(-1)?.date || todayIso;
  const endIso = visibleMeals.length ? lastDate : todayIso;

  const allFoods = visibleMeals.flatMap((meal) => meal.foods || []).map(normalize).filter(Boolean);
  const allTags = visibleMeals.flatMap((meal) => meal.tags || []).map(normalize).filter((tag) => tag && tag !== "unclear-source");
  const allCuisines = visibleMeals.map((meal) => normalize(meal.cuisine || "mixed")).filter(Boolean);
  const skippedCount = visibleMeals.filter((meal) => meal.tags?.includes("skipped") || meal.source === "skipped").length;

  const topFoods = countBy(allFoods).slice(0, 10);
  const topTags = countBy(allTags).slice(0, 10);
  const topCuisines = countBy(allCuisines).slice(0, 8);
  const mealTypeCounts = countBy(visibleMeals.map((meal) => meal.mealType));

  const breakfastDays = new Set(visibleMeals.filter((meal) => meal.mealType === "breakfast").map((meal) => meal.date)).size;
  const fullDays = [...daySet].filter((date) => MEAL_ORDER.every((mealType) => visibleMeals.some((meal) => meal.date === date && meal.mealType === mealType))).length;
  // Skipped meals are excluded from repeat detection so empty days do not register
  // as a "familiar" repeat. This matches buildRoutineMap's repeat counting.
  const repeatMeals = visibleMeals.filter((meal) => !(meal.tags?.includes("skipped") || meal.source === "skipped"));
  const uniqueFingerprints = new Set(repeatMeals.map(mealFingerprint)).size;
  const repeatGravity = percent(repeatMeals.length - uniqueFingerprints, repeatMeals.length);

  const coverageDays = Math.max(1, daysBetween(firstDate, lastDate) + 1);
  const publicCompleteness = percent(totalMeals, coverageDays * MEAL_ORDER.length);
  // Public endpoint: strip owner-only fields (raw_text, redacted_text, etc.)
  // from the meals returned to the board.
  const latestMeals = [...visibleMeals]
    .sort((a, b) => `${b.date}:${MEAL_ORDER.indexOf(b.mealType)}`.localeCompare(`${a.date}:${MEAL_ORDER.indexOf(a.mealType)}`))
    .slice(0, 18)
    .map(toPublicMeal);
  const recentComments = flattenComments(visibleMeals);
  const topCommenters = countBy(recentComments.map((comment) => normalize(comment.name))).slice(0, 6);

  return {
    generatedAt: new Date().toISOString(),
    totalMeals,
    loggedDays,
    firstDate,
    lastDate,
    fullDays,
    skippedCount,
    publicCompleteness,
    breakfastConsistency: percent(breakfastDays, loggedDays),
    repeatGravity,
    mealTypeCounts,
    topFoods,
    topTags,
    topCuisines,
    routineMap: buildRoutineMap(visibleMeals, endIso),
    digest: buildDigest({ meals: visibleMeals, topFoods, topTags, topCuisines, loggedDays }),
    commentCount: recentComments.length,
    activeCommenters: new Set(recentComments.map((comment) => normalize(comment.name))).size,
    topCommenters,
    recentComments: recentComments.slice(0, 18),
    latestMeals
  };
}
