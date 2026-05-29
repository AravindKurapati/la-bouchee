import { addComment } from "../../../src/store.mjs";
import { readBody, sendError } from "../../_body.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    res.status(201).json(await addComment(req.query.id, await readBody(req)));
  } catch (error) {
    sendError(res, error);
  }
}
