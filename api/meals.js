import { runMealAgentGraph } from "../src/agentGraph.mjs";
import { readMeals, saveMeal } from "../src/store.mjs";
import { isOwnerRequest, requireOwner } from "../src/auth.mjs";
import { toPublicMeals } from "../src/publicMeal.mjs";
import { readBody, sendError } from "./_body.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const meals = await readMeals();
      // Owners get full rows (incl. raw_text + private meals) for the console;
      // everyone else gets only public meals with owner-only fields stripped.
      // The service-role read path bypasses RLS, so this filter is the real
      // privacy boundary — not the policy in supabase/schema.sql.
      res.status(200).json((await isOwnerRequest(req)) ? meals : toPublicMeals(meals));
      return;
    }

    if (req.method === "POST") {
      await requireOwner(req);
      const body = await readBody(req);
      const meal = body.foods && body.publicCaption ? body : await runMealAgentGraph(body);
      res.status(201).json(await saveMeal(meal));
      return;
    }

    res.setHeader("Allow", "GET, POST");
    res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    sendError(res, error);
  }
}
