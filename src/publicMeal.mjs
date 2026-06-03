// Public-facing meal projection.
//
// The read path uses the Supabase service-role key, which BYPASSES the
// `meals_public_read` RLS policy. So row-level filtering must also happen in
// app code before any meal reaches an unauthenticated caller. These helpers are
// the single chokepoint that (a) drops private meals and (b) strips owner-only
// fields that must never appear on the public board or in public stats.

// Never sent to unauthenticated callers. `rawText` is the un-redacted original
// entry; the others are internal analysis artifacts. The public surface only
// needs `publicCaption`, foods, tags, cuisine, etc.
export const OWNER_ONLY_FIELDS = ["rawText", "redactedText", "privacyIssues", "confidence", "publishable"];

export function toPublicMeal(meal) {
  const result = { ...meal };
  for (const field of OWNER_ONLY_FIELDS) delete result[field];
  return result;
}

export function toPublicMeals(meals) {
  return (Array.isArray(meals) ? meals : [])
    .filter((meal) => meal.visibility === "public")
    .map(toPublicMeal);
}
