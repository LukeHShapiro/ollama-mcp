import fs from "fs";
import path from "path";
import readline from "readline";

const rl = readline.createInterface({ input: process.stdin });
let raw = "";
rl.on("line", (line) => (raw += line));
rl.on("close", () => {
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
    "",
    "=== TO CONTINUE WITH QWEN ===",
    "1. Open terminal in this project directory",
    "2. Run: aider",
    "   (config auto-loads qwen3-coder from .aider.conf.yml)",
    "",
    "3. Inside aider, add relevant files:",
    "   /add <files mentioned in summary above>",
    "",
    "4. Paste this to qwen to resume:",
    `   "I'm continuing work from a Claude Code session. Here's where we left off:\n\n${summary}"`,
  ].join("\n");

  fs.writeFileSync(file, content, "utf8");
  process.stdout.write(JSON.stringify({
    systemMessage: `Handoff file written: ${file}`,
  }));
});
