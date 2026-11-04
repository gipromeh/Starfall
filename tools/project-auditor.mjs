#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
const arg = process.argv.indexOf("--report-dir");
const output = path.resolve(root, arg >= 0 ? process.argv[arg + 1] : "audit-report");
const checks = [];
const findings = [];
let filesRead = 0;
const check = (id, pass, detail) => checks.push({ id, status: pass ? "PASS" : "FAIL", detail });
const issue = (severity, id, file, message) => findings.push({ severity, id, file, message });
const exists = file => fs.existsSync(path.join(root, file));
function read(file) {
  const full = path.join(root, file);
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return null;
  filesRead++;
  return fs.readFileSync(full, "utf8");
}
function walk(dir, result = []) {
  const full = path.join(root, dir);
  if (!fs.existsSync(full)) return result;
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    if ([".git", "node_modules", "audit-report"].includes(entry.name)) continue;
    const rel = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) walk(rel, result);
    else if (entry.isFile()) result.push(rel);
  }
  return result;
}

const required = [
  "starfall.html", "index.html", "README.md", "STARFALL_PASSPORT.md",
  "STARFALL_MASTER_INSTRUCTION.yaml", ".github/workflows/game-tests.yml",
  ".github/workflows/deploy-starfall-pages.yml", "tests", "tools"
];
for (const file of required) {
  const pass = exists(file);
  check("required:" + file, pass, pass ? "present" : "missing");
  if (!pass) issue("ERROR", "REQUIRED_PATH_MISSING", file, "Required project path is missing.");
}

const html = read("starfall.html");
const readme = read("README.md");
const passport = read("STARFALL_PASSPORT.md");
const master = read("STARFALL_MASTER_INSTRUCTION.yaml");
const ci = read(".github/workflows/game-tests.yml");
const deploy = read(".github/workflows/deploy-starfall-pages.yml");

if (html) {
  const version = html.match(/<meta\s+name=["']starfall-version["']\s+content=["']([^"']+)["']/i)?.[1] || "";
  check("version:html-marker", Boolean(version), version || "missing");
  if (!version) issue("ERROR", "VERSION_MARKER_MISSING", "starfall.html", "The authoritative game version marker is missing.");
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || "";
  check("html:title", Boolean(title), title || "missing");
  if (!title) issue("WARNING", "HTML_TITLE_MISSING", "starfall.html", "Document title is missing.");

  const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "").replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, "");
  const ids = new Map();
  for (const match of markup.matchAll(/\bid\s*=\s*(["'])(.*?)\1/gi)) ids.set(match[2], (ids.get(match[2]) || 0) + 1);
  const duplicates = [...ids].filter(([, count]) => count > 1);
  check("html:unique-ids", duplicates.length === 0, duplicates.length + " duplicate IDs");
  for (const [id, count] of duplicates) issue("WARNING", "DUPLICATE_HTML_ID", "starfall.html", "ID " + id + " occurs " + count + " times.");

  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)]
    .filter(match => !/\bsrc\s*=/i.test(match[1]) && !/\btype\s*=\s*["'](?:application\/json|application\/ld\+json)["']/i.test(match[1]))
    .map(match => match[2]).filter(source => source.trim());
  check("javascript:inline-scripts", scripts.length > 0, scripts.length + " executable inline scripts");
  let syntaxErrors = 0;
  scripts.forEach((source, index) => {
    try { new vm.Script(source, { filename: "starfall-inline-" + (index + 1) + ".js" }); }
    catch (error) {
      syntaxErrors++;
      issue("ERROR", "INLINE_JS_SYNTAX", "starfall.html", "Inline script " + (index + 1) + ": " + error.message);
    }
  });
  check("javascript:inline-syntax", syntaxErrors === 0, syntaxErrors + " syntax errors");

  const missing = new Set();
  const refs = /\b(?:src|href|poster|data-src)\s*=\s*(["'])(.*?)\1/gi;
  for (const match of markup.matchAll(refs)) {
    const value = match[2].trim();
    if (!value || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|\/|data:|blob:|javascript:)/i.test(value) || /[{}<>]/.test(value) || value.includes('+') || value.includes('[') || value.includes(']') || value.includes('$')) continue;
    const target = path.posix.normalize(value.split(/[?#]/, 1)[0]);
    if (!exists(target)) missing.add(target);
  }
  check("html:local-references", missing.size === 0, missing.size + " missing local references");
  for (const file of missing) issue("ERROR", "BROKEN_LOCAL_REFERENCE", "starfall.html", "Referenced local file is missing: " + file);

  const bytes = Buffer.byteLength(html, "utf8");
  check("html:source-size", bytes <= 2000000, bytes + " bytes");
  if (bytes > 2000000) issue("WARNING", "LARGE_MAIN_HTML", "starfall.html", "Main game HTML exceeds 2 MB.");
} else check("html:main", false, "cannot read starfall.html");

if (html && passport && master) {
  const htmlVersion = html.match(/<meta\s+name=["']starfall-version["']\s+content=["']([^"']+)["']/i)?.[1] || "";
  const passportVersion = passport.match(/^game_version:\s*["']?([^"'\r\n]+)["']?/m)?.[1]?.trim() || "";
  const masterVersion = master.match(/^\s*current_version:\s*["']?([^"'\r\n]+)["']?/m)?.[1]?.trim() || "";
  check("version:passport", Boolean(htmlVersion && htmlVersion === passportVersion), "HTML=" + htmlVersion + "; passport=" + passportVersion);
  check("version:master-instruction", Boolean(htmlVersion && htmlVersion === masterVersion), "HTML=" + htmlVersion + "; master=" + masterVersion);
  if (htmlVersion && htmlVersion !== passportVersion) issue("ERROR", "VERSION_DRIFT_PASSPORT", "STARFALL_PASSPORT.md", "Passport game_version does not match starfall.html.");
  if (htmlVersion && htmlVersion !== masterVersion) issue("ERROR", "VERSION_DRIFT_MASTER", "STARFALL_MASTER_INSTRUCTION.yaml", "process.current_version does not match starfall.html.");
  const digest = passport.match(/^main_file_sha256:\s*["']([^"']+)["']/m)?.[1] || "";
  const actual = await import("node:crypto").then(({ createHash }) => createHash("sha256").update(fs.readFileSync(path.join(root, "starfall.html"))).digest("hex"));
  check("integrity:passport-sha256", Boolean(digest && digest === actual), digest ? "SHA-256 compared" : "passport hash missing");
  if (!digest || digest !== actual) issue("ERROR", "PASSPORT_SHA_MISMATCH", "STARFALL_PASSPORT.md", "Passport main_file_sha256 does not match starfall.html.");
}
if (html && readme) {
  const version = html.match(/<meta\s+name=["']starfall-version["']\s+content=["']([^"']+)["']/i)?.[1] || "";
  const pass = !version || readme.includes(version);
  check("docs:readme-version", pass, version || "version unavailable");
  if (!pass) issue("WARNING", "README_VERSION_DRIFT", "README.md", "README does not mention game version " + version + ".");
}
if (ci) {
  const refs = new Set();
  for (const match of ci.matchAll(/\b(?:node|python3?)\s+((?:tests|tools)\/[A-Za-z0-9_./-]+\.(?:mjs|js|py))/g)) refs.add(match[1]);
  const missing = [...refs].filter(file => !exists(file));
  check("ci:referenced-files", missing.length === 0, refs.size + " paths; " + missing.length + " missing");
  for (const file of missing) issue("ERROR", "CI_REFERENCED_FILE_MISSING", file, "Existing CI workflow references a missing file.");
}
if (deploy) {
  const missing = ["starfall.html", "index.html", "assets", "tools", "data"].filter(file => !deploy.includes(file));
  check("deploy:payload", missing.length === 0, missing.length ? missing.join(", ") : "core deployment paths referenced");
  for (const file of missing) issue("ERROR", "DEPLOY_PAYLOAD_MISSING", ".github/workflows/deploy-starfall-pages.yml", "Deployment workflow omits " + file + ".");
}

const inventory = walk(".");
const large = inventory.map(file => {
  try { return { file, size: fs.statSync(path.join(root, file)).size }; } catch { return null; }
}).filter(item => item && item.size > 10 * 1024 * 1024);
check("inventory:files", true, inventory.length + " files");
check("inventory:large-assets", true, large.length + " informational files exceed 10 MiB");
for (const item of large) issue("INFO", "LARGE_ASSET", item.file, "Asset size is " + (item.size / 1048576).toFixed(1) + " MiB.");

const count = severity => findings.filter(item => item.severity === severity).length;
const errors = count("ERROR"), warnings = count("WARNING"), info = count("INFO");
const failedChecks = checks.filter(item => item.status === "FAIL");
const report = {
  auditor: "STARFALL Project Auditor", mode: "strict", schema_version: 1,
  generated_at: new Date().toISOString(),
  repository: process.env.GITHUB_REPOSITORY || null,
  commit: process.env.GITHUB_SHA || null,
  ref: process.env.GITHUB_REF || null,
  status: errors || warnings || failedChecks.length ? "FAIL" : "PASS",
  summary: { checks: checks.length, failed_checks: failedChecks.length, files_read: filesRead, errors, warnings, info },
  checks, findings
};
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, "audit-report.json"), JSON.stringify(report, null, 2) + "\n");
const lines = [
  "# STARFALL Project Audit", "", "**Mode:** STRICT", "**Status:** " + report.status, "",
  "| Metric | Result |", "|---|---:|", "| Checks | " + checks.length + " |", "| Failed checks | " + failedChecks.length + " |",
  "| Files read | " + filesRead + " |", "| Errors | " + errors + " |",
  "| Warnings | " + warnings + " |", "| Informational | " + info + " |", "",
  "## Checks", "", "| Check | Status | Details |", "|---|---|---|",
  ...checks.map(item => "| " + item.id + " | " + item.status + " | " + item.detail.replaceAll("|", "\\|") + " |"),
  "", "## Findings", ""
];
if (!findings.length) lines.push("No findings.");
for (const item of findings) lines.push("### [" + item.severity + "] " + item.id, "", "- File: " + item.file, "- " + item.message, "");
lines.push("## Scope", "", "Static repository audit only. It does not claim real-device iPhone, physical GPU, thermal, battery, or manual gameplay validation.", "");
fs.writeFileSync(path.join(output, "audit-report.md"), lines.join("\n"));
console.log(lines.join("\n"));
if (errors || warnings || failedChecks.length) process.exitCode = 1;
