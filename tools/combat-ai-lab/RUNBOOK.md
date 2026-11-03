# GitHub-hosted execution

This directory is executed by `.github/workflows/combat-ai-lab.yml` on GitHub-hosted
`ubuntu-latest` runners. No local workstation or self-hosted runner is required.

## Execution stages

1. `tests/t17_combat_ai_lab.mjs` — deterministic kernel and decision assertions.
2. `tests/t18_eai_parity.js` — Node kernel parity against the browser production EAI.
3. `tests/t19_production_combat_batch.js` — browser-driven production combat smoke batch.
4. `tools/combat-ai-lab/run.mjs` — 1,200 seeded headless combat trials.

## Outputs

- `artifacts/combat-ai-summary.json` — compact aggregate metrics.
- `artifacts/combat-ai-battles.json` — per-trial records (no per-frame trace).
- `artifacts/production-combat.json` — production-browser smoke report.

GitHub Actions uploads these as run artifacts with 30-day retention. Detailed frame traces
must be opt-in and limited to selected anomalous trials.

## Interpretation boundary

The headless duel runner uses the Elite-derived STARFALL EAI kernel port but retains an
abstract statistical weapon-hit model. The browser batch exercises the actual production
update and projectile collision path, but is a short smoke/baseline test, not a complete
multi-ship tactical validation. A successful workflow means the tests executed; it does
not by itself establish balanced or tactically competent pirate behavior.

The runner currently has a known validation issue: the last 1,200-trial artifact ended in
1,200 timeouts. Those draws must be treated as a simulator stall/deadlock signal, not as
evidence of balanced combat. Do not tune production AI from those results.
