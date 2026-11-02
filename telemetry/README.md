# STARFALL public flight telemetry

This directory stores raw, append-only flight observations from production game builds.

## Data layout

- raw/YYYY/MM/<session-id>/chunk-NNNNNN.jsonl

Each flight has one unique session ID. Each chunk is immutable, UTF-8 JSONL, and numbered from 1. Retried uploads are idempotent: an identical existing chunk is accepted; a different payload at the same path is rejected. Raw observations are never rewritten by analytics. Derived summaries belong under analytics/.

## Collection

STARFALL v92 automatically records at 5 Hz while the game is in flight. It captures player motion/orientation and controls, pirate NPC transforms and velocities, AI state/intent/decision variables, health changes, warp lifecycle, and projectile samples. Sessions end automatically when flight ends or the page is closed.

The browser buffers chunks locally and retries when connectivity returns. No account ID, player name, IP address, GitHub credential, or other direct personal identifier is intentionally written into records.

## One-time infrastructure setup

The static GitHub Pages game must not contain a GitHub token. The Cloudflare Worker in worker/index.mjs is the only writer.

1. Create a fine-grained GitHub token restricted to repository gipromeh/Starfall, with Contents: Read and write only. Do not use a classic account-wide token.
2. In repository Settings → Secrets and variables → Actions, create:
   - CLOUDFLARE_API_TOKEN — Cloudflare API token with permission to deploy Workers.
   - CLOUDFLARE_ACCOUNT_ID — Cloudflare account ID.
   - STARFALL_TELEMETRY_GITHUB_TOKEN — the fine-grained GitHub token from step 1.
3. Merge the Worker and deployment workflow to main. The workflow deploys the Worker and transfers STARFALL_TELEMETRY_GITHUB_TOKEN into the Worker as its GITHUB_TOKEN secret. The Worker variables GITHUB_REPOSITORY and ALLOWED_ORIGINS are defined in wrangler.toml.
4. Add a Cloudflare rate-limit rule for POST /ingest (recommended initial limit: 20 requests/minute/IP). The Worker also enforces a 56 KiB request-body limit.
5. Copy the deployed Worker URL from the deploy-telemetry-worker Actions run. Set it in the starfall-telemetry-endpoint meta tag in STARFALL_CURRENT.html, with the /ingest path, for example https://starfall-telemetry.<account-subdomain>.workers.dev/ingest. Commit that one-time endpoint configuration to main.
6. Run a test flight and verify that session_start, telemetry_sample, and session_end appear under raw/.

Until steps 1–5 are complete, the game records locally and retains a bounded upload queue, but cannot publish to GitHub. A deployed Worker and its secret are required for actual remote collection.

## Raw data contract

See schema/v1.json. Records are JSONL. The first record of each flight is session_start; the final record is session_end when the browser can complete shutdown. A page crash or forced process termination may leave a session without an end record.

## Analysis

Do not edit raw chunks. Load all chunks for a session in numeric order, validate every line against schema v1, then produce separate derived reports. Keep raw and derived data distinct so later analysis can be reproduced.
