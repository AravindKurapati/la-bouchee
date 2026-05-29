import { runMealAgentGraph } from "../src/agentGraph.mjs";
import { readMeals, saveMeal } from "../src/store.mjs";
import { readBody, sendError } from "./_body.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      res.status(200).json(await readMeals());
      return;
    }

    if (req.method === "POST") {
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
