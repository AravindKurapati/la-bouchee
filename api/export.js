import { readMeals } from "../src/store.mjs";
import { sendError } from "./_body.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=public-plate-meals.json");
    res.status(200).send(`${JSON.stringify(await readMeals(), null, 2)}\n`);
  } catch (error) {
    sendError(res, error);
  }
}
