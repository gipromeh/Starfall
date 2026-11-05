import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const html = readFileSync(new URL("../starfall.html", import.meta.url), "utf8");
const scriptTag = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
let parsed = 0;
for (const match of html.matchAll(scriptTag)) {
  const attrs = match[1] || "";
  const source = match[2] || "";
  if (/\bsrc\s*=/i.test(attrs) || !source.trim()) continue;
  const type = (attrs.match(/\btype\s*=\s*["']([^"']+)["']/i) || [])[1] || "";
  if (type && !/^(?:text|application)\/(?:javascript|ecmascript)$/i.test(type) && type !== "module") continue;
  const args = type === "module" ? ["--check", "--input-type=module"] : ["--check"];
  const result = spawnSync(process.execPath, args, { input: source, encoding: "utf8" });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || "Unknown JavaScript parse error\n");
    process.exit(result.status || 1);
  }
  parsed++;
}
if (!parsed) throw new Error("No inline JavaScript blocks were found.");

const fleetStart = html.indexOf("function pirateFleetUpdate(dt)");
const collisionStart = html.indexOf("function resolvePirateShipCollisions()", fleetStart);
if (fleetStart < 0 || collisionStart < 0) throw new Error("Pirate fleet update block is missing.");
const fleetUpdate = html.slice(fleetStart, collisionStart);
if (/\bg\.rotateZ\s*\(/.test(fleetUpdate)) throw new Error("Pirate roll still accumulates through rotateZ().");
if (!html.includes('const asset=MC["p"+ty]')) throw new Error("Loaded pirate GLB templates are not selected by mkPirate().");
if (!html.includes("window.StarfallPirateDiagnostics")) throw new Error("Pirate runtime diagnostics API is missing.");
if (!html.includes("STARFALL_SOCKET_ANCHOR_")) throw new Error("Non-destructive socket anchors are missing.");
if (!fleetUpdate.includes("e.vel.lengthSq()>1e-6?e.vel:e.hd")) throw new Error("Pirate hull is not aligned to actual velocity.");
if (!fleetUpdate.includes("g.quaternion.copy(pirateFleetTargetQuat)")) throw new Error("Pirate hull orientation is still delayed behind velocity.");
if (!fleetUpdate.includes("fireRange=[390,390,520,430]")) throw new Error("Jackal close-range firing envelope regressed.");
if (!html.includes('lowProfile=QL&&QL.mode==="low"')) throw new Error("LOW-profile fleet composition is missing.");
if (!html.includes("function asteroidFallback(reason)")) throw new Error("Asteroid GLB failure has no procedural fallback.");

console.log("Validated " + parsed + " inline JavaScript blocks and pirate-flight regression guards.");
