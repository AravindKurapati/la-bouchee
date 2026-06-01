import { publicConfig } from "../src/auth.mjs";
import { sendError } from "./_body.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    res.status(200).json(publicConfig());
  } catch (error) {
    sendError(res, error);
  }
}
