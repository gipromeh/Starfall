import assert from "node:assert/strict";
import worker from "../telemetry/worker/index.mjs";

const origin = "https://gipromeh.github.io";
const env = { GITHUB_TOKEN: "test-token", GITHUB_REPOSITORY: "gipromeh/Starfall", ALLOWED_ORIGINS: origin };
const sessionId = "sf-2026-11-03-12345678-abcd-ef01";
const records = [
  { schemaVersion: 1, sessionId, t: 0, wallTime: "2026-11-03T10:00:00.000Z", type: "session_start" },
  { schemaVersion: 1, sessionId, t: 0.2, wallTime: "2026-11-03T10:00:00.200Z", type: "telemetry_sample" }
].map(x => JSON.stringify(x)).join("\n") + "\n";

const preflight = await worker.fetch(new Request("https://worker.test/ingest", { method: "OPTIONS", headers: { Origin: origin } }), env);
assert.equal(preflight.status, 204);
assert.equal(preflight.headers.get("access-control-allow-origin"), origin);

const denied = await worker.fetch(new Request("https://worker.test/ingest", {
  method: "POST", headers: { Origin: "https://evil.example", "Content-Type": "application/json" },
  body: JSON.stringify({ sessionId, startedAt: "2026-11-03T10:00:00Z", chunkIndex: 1, records })
}), env);
assert.equal(denied.status, 403);

const invalid = await worker.fetch(new Request("https://worker.test/ingest", {
  method: "POST", headers: { Origin: origin, "Content-Type": "application/json" },
  body: JSON.stringify({ sessionId: "../bad", startedAt: "2026-11-03T10:00:00Z", chunkIndex: 1, records })
}), env);
assert.equal(invalid.status, 400);

let stored = null;
globalThis.fetch = async (_url, init = {}) => {
  if (init.method === "PUT") {
    stored = JSON.parse(init.body);
    return new Response(JSON.stringify({ content: { path: "telemetry/raw/test.jsonl" } }), { status: 201 });
  }
  if (stored) return new Response(JSON.stringify({ sha: "blob-sha", content: stored.content }), { status: 200 });
  return new Response(JSON.stringify({ message: "Not Found" }), { status: 404 });
};
const validRequest = () => new Request("https://worker.test/ingest", {
  method: "POST", headers: { Origin: origin, "Content-Type": "application/json" },
  body: JSON.stringify({ sessionId, startedAt: "2026-11-03T10:00:00Z", chunkIndex: 1, records })
});
const created = await worker.fetch(validRequest(), env);
assert.equal(created.status, 201);
assert.equal((await created.json()).ok, true);
const duplicate = await worker.fetch(validRequest(), env);
assert.equal(duplicate.status, 200);
assert.equal((await duplicate.json()).duplicate, true);
console.log("Flight recorder Worker tests: PASS");
