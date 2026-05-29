import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runMealAgentGraph } from "./src/agentGraph.mjs";
import { computeStats } from "./src/stats.mjs";
import { addComment, deleteMeal, readMeals, saveMeal } from "./src/store.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(root, "public");
const port = Number(process.env.PORT || 4266);

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"]
]);

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(body);
}

function sendError(res, status, message) {
  sendJson(res, status, { error: message });
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1_000_000) throw new Error("Request body too large");
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

async function serveStatic(req, res, pathname) {
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(publicDir, requestedPath));
  if (!filePath.startsWith(publicDir)) {
    sendError(res, 403, "Forbidden");
    return;
  }

  try {
    const data = await readFile(filePath);
    res.writeHead(200, {
      "content-type": mimeTypes.get(path.extname(filePath)) || "application/octet-stream"
    });
    res.end(data);
  } catch (error) {
    if (error.code === "ENOENT") {
      const index = await readFile(path.join(publicDir, "index.html"));
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(index);
      return;
    }
    throw error;
  }
}

async function route(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(url.pathname);

  if (req.method === "GET" && pathname === "/api/meals") {
    const meals = await readMeals();
    sendJson(res, 200, meals);
    return;
  }

  if (req.method === "GET" && pathname === "/api/stats") {
    const meals = await readMeals();
    sendJson(res, 200, computeStats(meals));
    return;
  }

  if (req.method === "GET" && pathname === "/api/comments") {
    const meals = await readMeals();
    sendJson(res, 200, computeStats(meals).recentComments);
    return;
  }

  if (req.method === "GET" && pathname === "/api/export") {
    const meals = await readMeals();
    res.writeHead(200, {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": "attachment; filename=public-plate-meals.json"
    });
    res.end(`${JSON.stringify(meals, null, 2)}\n`);
    return;
  }

  if (req.method === "POST" && pathname === "/api/analyze") {
    const body = await readBody(req);
    sendJson(res, 200, await runMealAgentGraph(body));
    return;
  }

  if (req.method === "POST" && pathname === "/api/meals") {
    const body = await readBody(req);
    const meal = body.foods && body.publicCaption ? body : await runMealAgentGraph(body);
    const saved = await saveMeal(meal);
    sendJson(res, 201, saved);
    return;
  }

  const commentMatch = pathname.match(/^\/api\/meals\/([^/]+)\/comments$/);
  if (req.method === "POST" && commentMatch) {
    const body = await readBody(req);
    const saved = await addComment(commentMatch[1], body);
    sendJson(res, 201, saved);
    return;
  }

  if (req.method === "DELETE" && pathname.startsWith("/api/meals/")) {
    const id = pathname.split("/").at(-1);
    const deleted = await deleteMeal(id);
    sendJson(res, deleted ? 200 : 404, { deleted });
    return;
  }

  await serveStatic(req, res, pathname);
}

const server = http.createServer((req, res) => {
  route(req, res).catch((error) => {
    console.error(error);
    sendError(res, error.statusCode || 500, error.message || "Unexpected server error");
  });
});

server.listen(port, () => {
  console.log(`Public Plate Agent running at http://localhost:${port}`);
});
