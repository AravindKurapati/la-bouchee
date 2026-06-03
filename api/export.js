import { readMeals } from "../src/store.mjs";
import { isOwnerRequest } from "../src/auth.mjs";
import { toPublicMeals } from "../src/publicMeal.mjs";
import { sendError } from "./_body.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    // Same privacy boundary as GET /api/meals: owners export everything, public
    // callers get only public meals with owner-only fields stripped.
    const meals = await readMeals();
    const payload = (await isOwnerRequest(req)) ? meals : toPublicMeals(meals);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=public-plate-meals.json");
    res.status(200).send(`${JSON.stringify(payload, null, 2)}\n`);
  } catch (error) {
    sendError(res, error);
  }
}
