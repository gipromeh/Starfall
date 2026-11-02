# STARFALL public flight telemetry

This directory stores raw, append-only flight observations from production game builds.

## Data layout

- raw/YYYY/MM/<session-id>/chunk-NNNNNN.jsonl

Each flight has one unique session ID. Each chunk is immutable, UTF-8 JSONL, and numbered from 1. Retried uploads are idempotent: an identical existing chunk is accepted; a different payload at the same path is rejected. Raw observations are never rewritten by analytics. Derived summaries belong under analytics/.

## Collection

STARFALL v92 automatically records at 5 Hz while the game is in flight. It captures player motion/orientation and controls, pirate NPC transforms and velocities, AI state/intent/decision variables, health changes, warp lifecycle, and projectile samples. Sessions end automatically when flight ends or the page is closed.

The browser buffers chunks locally and retries when connectivity returns. No account ID, player name, IP address, GitHub credential, or other direct personal identifier is intentionally written into records.

## Deploy the ingestion Worker

The static GitHub Pages game must not contain a GitHub token. The Cloudflare Worker in worker/index.mjs is the only writer.

1. Create a Cloudflare Worker named starfall-telemetry and deploy worker/index.mjs (Wrangler config: worker/wrangler.toml).
2. Create a fine-grained GitHub token restricted to repository gipromeh/Starfall, with Contents: Read and write only. Do not use a classic account-wide token.
3. Set Worker secrets/variables:
   - Secret GITHUB_TOKEN: the fine-grained token.
   - Variable GITHUB_REPOSITORY: gipromeh/Starfall.
   - Variable ALLOWED_ORIGINS: https://gipromeh.github.io (add local origins only for development).
4. Add a Cloudflare rate-limit rule for POST /ingest (recommended initial limit: 20 requests/minute/IP) and retain the Worker body-size limit.
5. Set the Worker URL in the starfall-telemetry-endpoint meta tag in STARFALL_CURRENT.html, using https://<worker-subdomain>.workers.dev/ingest.
6. Run a test flight and verify that session_start, telemetry_sample, and session_end appear under raw/.

Until step 5 is configured, the game records locally and retains a bounded upload queue, but cannot publish to GitHub. A deployed Worker and its secret are required for actual remote collection.

## Raw data contract

See schema/v1.json. Records are JSONL. The first record of each flight is session_start; the final record is session_end when the browser can complete shutdown. A page crash or forced process termination may leave a session without an end record.

## Analysis

Do not edit raw chunks. Load all chunks for a session in numeric order, validate every line against schema v1, then produce separate derived reports. Keep raw and derived data distinct so later analysis can be reproduced.
