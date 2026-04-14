import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 4000;
const PROJECT_DIR = process.env.PROJECT_DIR || process.cwd();

const IGNORE = new Set([".git", "node_modules", ".aider.tags.cache.v3", ".aider.tags.cache.v4", "handoff-*.txt"]);
const IGNORE_EXT = new Set([".docx", ".xlsx", ".pdf", ".png", ".jpg", ".jpeg", ".gif", ".ico", ".zip", ".exe"]);
const MAX_FILE_SIZE = 100 * 1024; // 100KB

function buildTree(dir, depth = 0, maxDepth = 4) {
  if (depth > maxDepth) return [];
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; }
  const lines = [];
  for (const e of entries) {
    if (IGNORE.has(e.name) || e.name.startsWith(".aider")) continue;
    const rel = path.relative(PROJECT_DIR, path.join(dir, e.name)).replace(/\\/g, "/");
    const indent = "  ".repeat(depth);
    if (e.isDirectory()) {
      lines.push(`${indent}${e.name}/`);
      lines.push(...buildTree(path.join(dir, e.name), depth + 1, maxDepth));
    } else {
      if (!IGNORE_EXT.has(path.extname(e.name).toLowerCase())) {
        lines.push(`${indent}${e.name}`);
      }
    }
  }
  return lines;
}

function readFile(relPath) {
  const abs = path.resolve(PROJECT_DIR, relPath);
  const normalAbs = abs.replace(/\\/g, "/");
  const normalDir = PROJECT_DIR.replace(/\\/g, "/");
  if (!normalAbs.startsWith(normalDir)) return { error: "Access denied" };
  try {
    const stat = fs.statSync(abs);
    if (stat.size > MAX_FILE_SIZE) return { error: "File too large (>100KB)" };
    return { content: fs.readFileSync(abs, "utf8") };
  } catch (e) {
    return { error: e.message };
  }
}

function writeFile(relPath, content) {
  const abs = path.resolve(PROJECT_DIR, relPath);
  const normalAbs = abs.replace(/\\/g, "/");
  const normalDir = PROJECT_DIR.replace(/\\/g, "/");
  if (!normalAbs.startsWith(normalDir)) return { error: "Access denied" };
  try {
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, "utf8");
    return { ok: true };
  } catch (e) {
    return { error: e.message };
  }
}

function latestHandoff() {
  try {
    const files = fs.readdirSync(PROJECT_DIR)
      .filter(f => f.match(/^handoff-.*\.txt$/))
      .sort().reverse();
    if (!files.length) return null;
    return fs.readFileSync(path.join(PROJECT_DIR, files[0]), "utf8");
  } catch { return null; }
}

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function json(res, data) {
  cors(res);
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function body(req) {
  return new Promise((resolve) => {
    let d = "";
    req.on("data", c => d += c);
    req.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === "OPTIONS") { cors(res); res.writeHead(204); res.end(); return; }

  if (url.pathname === "/api/context") {
    const tree = buildTree(PROJECT_DIR).join("\n");
    const systemPrompt = [
      `You are a coding assistant with full access to the project at: ${PROJECT_DIR}`,
      "",
      "Project file tree:",
      "```",
      tree,
      "```",
      "",
      "You can read any file by asking the user to use the 'Read file' button, or by referencing file paths.",
      "When suggesting code changes, specify the exact file path and provide the complete updated content.",
    ].join("\n");
    return json(res, { systemPrompt, projectDir: PROJECT_DIR, tree });
  }

  if (url.pathname === "/api/handoff") {
    return json(res, { content: latestHandoff() });
  }

  if (url.pathname === "/api/file" && req.method === "GET") {
    const rel = url.searchParams.get("path");
    if (!rel) return json(res, { error: "Missing path" });
    return json(res, readFile(rel));
  }

  if (url.pathname === "/api/file" && req.method === "POST") {
    const { path: rel, content } = await body(req);
    if (!rel || content == null) return json(res, { error: "Missing path or content" });
    return json(res, writeFile(rel, content));
  }

  // Serve index.html
  const file = path.join(__dirname, "ui", "index.html");
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end("Not found"); return; }
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Qwen UI → http://localhost:${PORT}`);
  console.log(`Project:  ${PROJECT_DIR}`);
});
