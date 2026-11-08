import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const root = new URL("../", import.meta.url);
const read = path => readFileSync(new URL(path, root), "utf8");
const html = read("starfall.html");
const decision = read("src/ai/yuka-pirate-decision.js");
const adapter = read("src/ai/starfall-yuka-adapter.js");
const flight = read("src/ai/yuka-pirate-flight.js");
const scriptTag = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
let parsed = 0;
for (const match of html.matchAll(scriptTag)) {
  const attrs = match[1] || "", source = match[2] || "";
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
if (!html.includes("window.StarfallPirateDiagnostics") || !html.includes("list:function(){return pirateFleet;}")) throw new Error("Pirate runtime diagnostics API is missing.");
if (!html.includes("STARFALL_SOCKET_ANCHOR_")) throw new Error("Non-destructive socket anchors are missing.");
if (!fleetUpdate.includes("SF_YUKA_PIRATE_AI.update")) throw new Error("Yuka does not control the pirate fleet.");
if (!fleetUpdate.includes("e.vel.lengthSq()>1e-6?e.vel:e.hd")) throw new Error("Pirate hull is not aligned to actual velocity.");
if (fleetUpdate.includes("EAI.command(e") || fleetUpdate.includes("EAI.integrate(e")) throw new Error("Legacy EAI still controls pirate movement.");
if (!fleetUpdate.includes("fireRange=[390,390,520,430]")) throw new Error("Jackal close-range firing envelope regressed.");
if (!html.includes('lowProfile=QL&&QL.mode==="low"')) throw new Error("LOW-profile fleet composition is missing.");
if (!html.includes("function asteroidFallback(reason)")) throw new Error("Asteroid GLB failure has no procedural fallback.");
if (!html.includes('src/vendor/yuka.js') || !html.includes('src/ai/yuka-pirate-decision.js') ||
    !html.includes('src/ai/starfall-yuka-adapter.js') || !html.includes('src/ai/yuka-pirate-flight.js')) {
  throw new Error("Yuka runtime layers are not loaded in dependency order.");
}
if (!decision.includes("new Y.Think(owner)") || !decision.includes("extends Y.GoalEvaluator") ||
    !decision.includes("decisionHz:15")) throw new Error("Yuka Think/GoalEvaluator arbitration at 15 Hz is missing.");
if (!adapter.includes("entity.g.position.addScaledVector(entity.vel,dt)") ||
    !adapter.includes("entity.g.quaternion.slerp(targetRotation") ||
    !adapter.includes('authority:"STARFALL"') || !adapter.includes('orientationAuthority:"STARFALL"')) {
  throw new Error("Starfall Adapter does not own position, velocity and quaternion orientation.");
}
if (!flight.includes("v.steering.calculate(dt,pilot.force)") || !flight.includes("Adapter.integrate(entity,force,dt")) {
  throw new Error("Yuka Steering forces are not routed through the Starfall Adapter.");
}
if (flight.includes("v.update(dt)") || flight.includes("v.rotateTo(")) {
  throw new Error("Yuka Vehicle still integrates authoritative movement or orientation.");
}
if (html.includes("pirate-ai-integration.js") || html.includes("SF_PIRATE_AI") ||
    html.includes("pirateFleetPursuit") || html.includes("PF_PURSUIT_RANGE")) {
  throw new Error("Legacy pirate AI runtime is still referenced.");
}
if (!html.includes('if(state!=="play"){') || !html.includes("for(let i=deb.length-1;i>=0;i--)") ||
    !html.includes("for(let i=ali.length-1;i>=0;i--)")) {
  throw new Error("Transient effects are not cleaned after gameplay stops.");
}
if (!html.includes("PC_CRUISE=100") || !html.includes("pirateTransport?58+Math.random()*16")) {
  throw new Error("Pirate transport speed profile regressed.");
}
if (!html.includes('kind:"pirateConvoy"') || !html.includes("pirateConvoyDamage(h.o,9999,false)")) {
  throw new Error("Pirate transport hull collision handling is missing.");
}

console.log("Validated " + parsed + " inline JavaScript blocks, Yuka Decision/Steering layers, Starfall movement authority, effect cleanup and transport collision guards.");
