const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const MAX_BODY_BYTES = 56 * 1024;
const MAX_RECORDS = 256;
const API_VERSION = "2022-11-28";

function response(body, status, origin, allowedOrigin) {
  const headers = new Headers(JSON_HEADERS);
  if (origin && (origin === allowedOrigin || allowedOrigin === "*")) {
    headers.set("access-control-allow-origin", origin);
    headers.set("vary", "Origin");
    headers.set("access-control-allow-methods", "POST, OPTIONS");
    headers.set("access-control-allow-headers", "Content-Type");
    headers.set("access-control-max-age", "86400");
  }
  return new Response(JSON.stringify(body), { status, headers });
}
function encodeBase64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
function decodeBase64(value) {
  const binary = atob((value || "").replace(/\s/g, ""));
  return new TextDecoder().decode(Uint8Array.from(binary, c => c.charCodeAt(0)));
}
function validSessionId(value) {
  return typeof value === "string" && /^sf-\d{4}-\d{2}-\d{2}-[a-z0-9-]{8,50}$/.test(value);
}
async function githubRequest(url, token, init = {}) {
  return fetch(url, {
    ...init,
    headers: {
      accept: "application/vnd.github+json",
      authorization: "Bearer " + token,
      "x-github-api-version": API_VERSION,
      "user-agent": "STARFALL-Flight-Recorder/1.0",
      ...(init.headers || {})
    }
  });
}
export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowList = (env.ALLOWED_ORIGINS || "https://gipromeh.github.io").split(",").map(x => x.trim()).filter(Boolean);
    const allowed = allowList.includes(origin);
    const allowHeader = allowed ? origin : "";
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      if (!allowed) return new Response(null, { status: 403 });
      return response({ ok: true }, 204, origin, allowHeader);
    }
    if (url.pathname !== "/ingest" || request.method !== "POST") return response({ error: "not_found" }, 404, origin, allowHeader);
    if (!allowed) return response({ error: "origin_not_allowed" }, 403, origin, allowHeader);
    if (!env.GITHUB_TOKEN) return response({ error: "server_not_configured" }, 503, origin, allowHeader);
    const declaredLength = Number(request.headers.get("Content-Length") || 0);
    if (declaredLength > MAX_BODY_BYTES) return response({ error: "payload_too_large" }, 413, origin, allowHeader);
    let payload;
    try {
      const raw = await request.text();
      if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return response({ error: "payload_too_large" }, 413, origin, allowHeader);
      payload = JSON.parse(raw);
    } catch {
      return response({ error: "invalid_json" }, 400, origin, allowHeader);
    }
    const { sessionId, startedAt, chunkIndex, records } = payload || {};
    if (!validSessionId(sessionId) || typeof startedAt !== "string" || !Number.isFinite(Date.parse(startedAt)) ||
        !Number.isInteger(chunkIndex) || chunkIndex < 1 || chunkIndex > 999999 ||
        typeof records !== "string" || !records.endsWith("\n")) return response({ error: "invalid_payload" }, 400, origin, allowHeader);
    const lines = records.trimEnd().split("\n");
    if (!lines.length || lines.length > MAX_RECORDS) return response({ error: "invalid_record_count" }, 400, origin, allowHeader);
    try {
      for (const line of lines) {
        const record = JSON.parse(line);
        if (!record || record.schemaVersion !== 1 || record.sessionId !== sessionId || typeof record.type !== "string" || !Number.isFinite(record.t)) {
          return response({ error: "invalid_record_schema" }, 400, origin, allowHeader);
        }
      }
    } catch {
      return response({ error: "invalid_record_json" }, 400, origin, allowHeader);
    }
    const date = new Date(startedAt);
    const year = String(date.getUTCFullYear());
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const chunk = String(chunkIndex).padStart(6, "0");
    const path = "telemetry/raw/" + year + "/" + month + "/" + sessionId + "/chunk-" + chunk + ".jsonl";
    const repository = env.GITHUB_REPOSITORY || "gipromeh/Starfall";
    const apiUrl = "https://api.github.com/repos/" + repository + "/contents/" + path;
    try {
      const existing = await githubRequest(apiUrl + "?ref=main", env.GITHUB_TOKEN);
      if (existing.ok) {
        const file = await existing.json();
        if (file.content && decodeBase64(file.content) === records) return response({ ok: true, duplicate: true, path }, 200, origin, allowHeader);
        return response({ error: "chunk_conflict", path }, 409, origin, allowHeader);
      }
      if (existing.status !== 404) return response({ error: "github_read_failed", status: existing.status }, 502, origin, allowHeader);
      const write = await githubRequest(apiUrl, env.GITHUB_TOKEN, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "telemetry: " + sessionId + " chunk " + chunk, content: encodeBase64(records), branch: "main" })
      });
      if (!write.ok) {
        const detail = await write.text();
        return response({ error: "github_write_failed", status: write.status, detail: detail.slice(0, 500) }, 502, origin, allowHeader);
      }
      return response({ ok: true, path }, 201, origin, allowHeader);
    } catch (error) {
      return response({ error: "upstream_failure", detail: String(error).slice(0, 300) }, 502, origin, allowHeader);
    }
  }
};
