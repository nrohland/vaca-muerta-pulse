#!/usr/bin/env node
// Pure-Node markdown checks (no dependencies): relative-link integrity and
// table well-formedness. Serves the Hito 0 Definition of Done in AGENTS.md:
// broken links or tables must not merge. Anchors are validated best-effort.
//
// Usage: node lint.mjs [ROOT_DIR]
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";

const ROOT = resolve(process.argv[2] ?? ".");
const IGNORE_DIRS = new Set([
  ".git", "node_modules", ".meltano", ".venv", "venv", "target",
  "dbt_packages", ".next", "out", ".turbo", ".pytest_cache", ".mypy_cache",
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

// Remove fenced code blocks (``` or ~~~) and inline code so their contents
// are not mistaken for links or table rows.
function stripCode(text) {
  const lines = text.split("\n");
  const out = [];
  let fence = null;
  for (const line of lines) {
    const m = line.match(/^\s*(`{3,}|~{3,})/);
    if (fence) {
      if (m && line.trim().startsWith(fence)) fence = null;
      out.push(""); // keep line numbering stable
      continue;
    }
    if (m) { fence = m[1][0].repeat(3); out.push(""); continue; }
    out.push(line.replace(/`[^`]*`/g, ""));
  }
  return out;
}

// GitHub-style heading slug (keeps unicode letters/numbers).
function slugify(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-");
}

function headingSlugs(text) {
  const seen = new Map();
  const slugs = new Set();
  for (const line of stripCode(text)) {
    const m = line.match(/^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$/);
    if (!m) continue;
    let base = slugify(m[1]);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    slugs.add(n === 0 ? base : `${base}-${n}`);
  }
  return slugs;
}

const LINK_RE = /\[[^\]]*\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/g;
const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

const errors = [];
const warnings = [];
let linkCount = 0;
let tableCount = 0;

const slugCache = new Map();
function slugsFor(file) {
  if (!slugCache.has(file)) {
    slugCache.set(file, existsSync(file) ? headingSlugs(readFileSync(file, "utf8")) : null);
  }
  return slugCache.get(file);
}

function checkLinks(file, cleaned) {
  const text = cleaned.join("\n");
  let m;
  while ((m = LINK_RE.exec(text))) {
    const raw = m[1];
    if (raw.startsWith("#")) {
      // in-page anchor
      linkCount++;
      const slugs = slugsFor(file);
      if (slugs && !slugs.has(raw.slice(1))) {
        warnings.push(`${rel(file)}: unresolved in-page anchor "${raw}"`);
      }
      continue;
    }
    if (EXTERNAL.test(raw)) { linkCount++; continue; }
    linkCount++;
    const [pathPart, anchor] = raw.split("#");
    const targetPath = resolve(dirname(file), decodeURIComponent(pathPart));
    if (!existsSync(targetPath)) {
      errors.push(`${rel(file)}: broken link -> "${raw}" (missing ${rel(targetPath)})`);
      continue;
    }
    if (anchor && targetPath.toLowerCase().endsWith(".md")) {
      const slugs = slugsFor(targetPath);
      if (slugs && !slugs.has(anchor)) {
        warnings.push(`${rel(file)}: link "${raw}" points to missing anchor "#${anchor}"`);
      }
    }
  }
}

function splitRow(line) {
  // Split a table row on unescaped pipes, dropping the outer border cells.
  const cells = line.replace(/\\\|/g, "\u0000").split("|").map((c) => c.replace(/\u0000/g, "\\|"));
  if (cells.length && cells[0].trim() === "") cells.shift();
  if (cells.length && cells[cells.length - 1].trim() === "") cells.pop();
  return cells;
}

const DELIM_RE = /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/;

function checkTables(file, cleaned) {
  for (let i = 0; i < cleaned.length - 1; i++) {
    const header = cleaned[i];
    const delim = cleaned[i + 1];
    if (!header.includes("|")) continue;
    if (!DELIM_RE.test(delim)) continue;
    const cols = splitRow(header).length;
    if (splitRow(delim).length !== cols) {
      errors.push(`${rel(file)}:${i + 2}: table delimiter has ${splitRow(delim).length} cols, header has ${cols}`);
    }
    tableCount++;
    let j = i + 2;
    for (; j < cleaned.length; j++) {
      const row = cleaned[j];
      if (!row.includes("|") || row.trim() === "") break;
      const n = splitRow(row).length;
      if (n !== cols) {
        errors.push(`${rel(file)}:${j + 1}: table row has ${n} cols, expected ${cols}`);
      }
    }
    i = j - 1;
  }
}

function rel(p) {
  const r = relative(ROOT, p);
  return r.startsWith("..") ? p : r || ".";
}

const files = walk(ROOT);
for (const file of files) {
  const cleaned = stripCode(readFileSync(file, "utf8"));
  checkLinks(file, cleaned);
  checkTables(file, cleaned);
}

console.log(`[lint] scanned ${files.length} markdown file(s): ${linkCount} link(s), ${tableCount} table(s)`);
for (const w of warnings) console.log(`  WARN  ${w}`);
for (const e of errors) console.log(`  ERROR ${e}`);
if (errors.length) {
  console.log(`[lint] FAIL: ${errors.length} error(s), ${warnings.length} warning(s)`);
  process.exit(1);
}
console.log(`[lint] OK${warnings.length ? ` (${warnings.length} warning(s))` : ""}`);
