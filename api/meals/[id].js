import { deleteMeal } from "../../src/store.mjs";
import { requireOwner } from "../../src/auth.mjs";
import { sendError } from "../_body.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "DELETE") {
      res.setHeader("Allow", "DELETE");
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    await requireOwner(req);
    const deleted = await deleteMeal(req.query.id);
    res.status(deleted ? 200 : 404).json({ deleted });
  } catch (error) {
    sendError(res, error);
  }
}
