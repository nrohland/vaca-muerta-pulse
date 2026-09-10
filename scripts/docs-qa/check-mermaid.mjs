#!/usr/bin/env node
// Validate every ```mermaid block in the docs. When the Mermaid CLI (mmdc) is
// available it renders each file (full parser validation) using the system
// Chrome; otherwise it falls back to a dependency-free structural check.
// Serves the Hito 0 Definition of Done in AGENTS.md: broken Mermaid must not
// merge.
//
// Usage: node check-mermaid.mjs [ROOT_DIR]
import { readFileSync, readdirSync, existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const ROOT = resolve(process.argv[2] ?? ".");
const IGNORE_DIRS = new Set([
  ".git", "node_modules", ".meltano", ".venv", "venv", "target",
  "dbt_packages", ".next", "out", ".turbo",
]);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      walk(join(dir, entry.name), out);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

function extractBlocks(text) {
  const blocks = [];
  const lines = text.split("\n");
  let inBlock = false;
  let start = 0;
  let buf = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!inBlock) {
      if (/^\s*(`{3,}|~{3,})\s*mermaid\s*$/i.test(line)) {
        inBlock = true; start = i + 1; buf = [];
      }
    } else if (/^\s*(`{3,}|~{3,})\s*$/.test(line)) {
      blocks.push({ line: start + 1, code: buf.join("\n") });
      inBlock = false;
    } else {
      buf.push(line);
    }
  }
  if (inBlock) blocks.push({ line: start + 1, code: buf.join("\n"), unterminated: true });
  return blocks;
}

const DIAGRAM_TYPES = /^(?:%%[^\n]*\n\s*)?(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|journey|gantt|pie|gitGraph|mindmap|timeline|quadrantChart|requirementDiagram|C4Context|C4Container|C4Component|C4Dynamic|sankey|xychart|block-beta)\b/;

// Conservative, dependency-free sanity check used only when mmdc is absent.
// It intentionally flags only high-confidence problems (no false positives on
// valid diagrams); full syntax validation is done by mmdc in the environment.
function structuralCheck(block) {
  const problems = [];
  if (block.unterminated) problems.push("unterminated ```mermaid fence");
  const code = block.code.trim();
  if (!code) { problems.push("empty mermaid block"); return problems; }
  if (!DIAGRAM_TYPES.test(code)) {
    problems.push(`unrecognized diagram type (first token: "${code.split(/\s|\n/)[0]}")`);
  }
  return problems;
}

function findMmdc() {
  if (process.env.DOCS_QA_STRUCTURAL === "1") return null;
  const candidates = [
    process.env.MMDC_BIN,
    join(process.env.HOME || "", ".npm-global/bin/mmdc"),
  ].filter(Boolean);
  for (const c of candidates) if (existsSync(c)) return c;
  const which = spawnSync("bash", ["-lc", "command -v mmdc"], { encoding: "utf8" });
  if (which.status === 0) return which.stdout.trim();
  return null;
}

function findChrome() {
  const envPath = process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH;
  if (envPath && existsSync(envPath)) return envPath;
  for (const name of ["google-chrome-stable", "google-chrome", "chromium", "chromium-browser"]) {
    const w = spawnSync("bash", ["-lc", `command -v ${name}`], { encoding: "utf8" });
    if (w.status === 0 && w.stdout.trim()) return w.stdout.trim();
  }
  return null;
}

function rel(p) {
  const r = relative(ROOT, p);
  return r.startsWith("..") ? p : r || ".";
}

const files = walk(ROOT);
const withMermaid = [];
let blockCount = 0;
for (const file of files) {
  const blocks = extractBlocks(readFileSync(file, "utf8"));
  if (blocks.length) { withMermaid.push({ file, blocks }); blockCount += blocks.length; }
}

console.log(`[mermaid] ${blockCount} diagram(s) across ${withMermaid.length} file(s)`);

const mmdc = findMmdc();
const errors = [];

if (mmdc) {
  const chrome = findChrome();
  const cfgDir = mkdtempSync(join(tmpdir(), "mmdc-"));
  const puppeteerCfg = join(cfgDir, "puppeteer.json");
  writeFileSync(puppeteerCfg, JSON.stringify({
    ...(chrome ? { executablePath: chrome } : {}),
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  }));
  console.log(`[mermaid] engine: mmdc render (${mmdc})${chrome ? ` via ${chrome}` : ""}`);
  for (const { file } of withMermaid) {
    const outFile = join(cfgDir, "out-" + Buffer.from(rel(file)).toString("hex") + ".md");
    const res = spawnSync(mmdc, ["-i", file, "-o", outFile, "-p", puppeteerCfg, "-q"], {
      encoding: "utf8",
      cwd: dirname(file),
    });
    if (res.status !== 0) {
      const msg = (res.stderr || res.stdout || "")
        .split("\n")
        .map((l) => l.trimEnd())
        .filter((l) => l && !/^\s*at\s/.test(l) && !l.includes("node_modules") && !l.includes(".invalid"))
        .slice(-4)
        .join(" | ") || `exit ${res.status}`;
      errors.push(`${rel(file)}: mermaid render failed -> ${msg}`);
    }
  }
} else {
  console.log("[mermaid] engine: structural (mmdc not found; run install to enable full render)");
  for (const { file, blocks } of withMermaid) {
    for (const block of blocks) {
      for (const p of structuralCheck(block)) {
        errors.push(`${rel(file)}:${block.line}: ${p}`);
      }
    }
  }
}

for (const e of errors) console.log(`  ERROR ${e}`);
if (errors.length) {
  console.log(`[mermaid] FAIL: ${errors.length} error(s)`);
  process.exit(1);
}
console.log("[mermaid] OK");
