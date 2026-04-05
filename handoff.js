import fs from "fs";
import path from "path";
import http from "http";
import readline from "readline";
import { spawn } from "child_process";

const UI_PORT = 4000;
const UI_SERVER = "C:/Users/scout/ollama-mcp/ui-server.js";

const rl = readline.createInterface({ input: process.stdin });
let raw = "";
rl.on("line", (line) => (raw += line));
rl.on("close", async () => {
  let summary = "(no summary available)";
  try {
    const data = JSON.parse(raw);
    summary = data.summary || summary;
  } catch {}

  const cwd = process.env.CLAUDE_CWD || process.cwd();
  const ts = new Date().toISOString().slice(0, 16).replace("T", "_").replace(":", "-");
  const file = path.join(cwd, `handoff-${ts}.txt`);

  const content = [
    "=== QWEN HANDOFF FILE ===",
    `Generated: ${new Date().toLocaleString()}`,
    "",
    "=== CONTEXT SUMMARY ===",
    summary,
  ].join("\n");

  fs.writeFileSync(file, content, "utf8");

  // Ensure UI server is running, start it if not
  const serverRunning = await checkPort(UI_PORT);
  if (!serverRunning) {
    spawn("node", [UI_SERVER], {
      detached: true,
      stdio: "ignore",
      env: { ...process.env, PROJECT_DIR: cwd },
    }).unref();
    await wait(1500); // give it time to start
  }

  // Open browser to the UI (it auto-loads the handoff on page open)
  spawn("powershell", ["-Command", `Start-Process "http://localhost:${UI_PORT}"`], {
    detached: true, stdio: "ignore",
  }).unref();

  process.stdout.write(JSON.stringify({
    systemMessage: `Handoff written → opening http://localhost:${UI_PORT}`,
  }));
});

function checkPort(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}`, () => { req.destroy(); resolve(true); });
    req.on("error", () => resolve(false));
    req.setTimeout(500, () => { req.destroy(); resolve(false); });
  });
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
