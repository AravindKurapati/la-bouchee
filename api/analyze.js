import { runMealAgentGraph } from "../src/agentGraph.mjs";
import { readBody, sendError } from "./_body.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    res.status(200).json(runMealAgentGraph(await readBody(req)));
  } catch (error) {
    sendError(res, error);
  }
}
