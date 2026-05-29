import { computeStats } from "../src/stats.mjs";
import { readMeals } from "../src/store.mjs";
import { sendError } from "./_body.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    res.status(200).json(computeStats(await readMeals()).recentComments);
  } catch (error) {
    sendError(res, error);
  }
}
