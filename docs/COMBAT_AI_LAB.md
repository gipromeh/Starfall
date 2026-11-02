# STARFALL Headless Combat AI Lab

## Purpose
An isolated, unattended GitHub Actions experiment for repeatable combat-AI evaluation. It must not modify production gameplay while the simulation model is being validated.

## Elite-derived kernel
`elite-eai.mjs` ports the v90 EAI primitives from `STARFALL_CURRENT.html`: 15 Hz tactical decisions (`4/60 s`), local OCS projections, quantized yaw/pitch/acceleration commands, per-frame orientation/velocity/position integration, xorshift32 PRNG, fire chance and fire gates.

Research basis: `docs/reference/ELITE_GAME_PASSPORT.md` §§5, 13–14 and `docs/reference/ELITE_TO_STARFALL_V90.md`. The port retains STARFALL units and adaptation boundaries; it does not claim bit-exact Elite emulation.

## Current batch model
- 1,200 seeded 1v1 trials per run.
- Matchups: interceptor/interceptor, interceptor/heavy, heavy/agile, agile/interceptor, heavy/heavy.
- 60 Hz integration and 15 Hz tactical decision cadence.
- Reports: per-trial JSON plus aggregate win/draw, duration, shots, hit-rate and damage metrics.
- GitHub Actions runs on branch updates and nightly; reports are retained as artifacts for 30 days.

## Important model boundary
The current runner uses the actual EAI kernel port, but its hit probability is an abstract statistical approximation. It does not yet run the production Three.js projectile collision, complete pirate state machine, squadron coordination, or production damage/lifecycle code. Thus it is a deterministic research harness, not yet a physics-identical production battle simulator. Its results may identify gross instability and compare controlled parameter variants, but must not be used alone to approve production balance changes.

## Acceptance path
1. Keep production `main` untouched.
2. Verify kernel parity against browser-side EAI regression probes.
3. Replace abstract hit/damage behavior only after extracting or browser-driving the real production projectile/collision rules.
4. Add squadron and multi-target scenarios only when the simulation includes the corresponding production state transitions.
5. Require repeatable seeded results, finite state, bounded velocities, no NaN/Infinity, no deadlock, and explicit scenario coverage before any production recommendation.


## First production-runtime baseline

GitHub Actions run #5 executed 12 headless Chromium trials, 20 simulated seconds each, using the real production `upd(dt)` wrapper and production projectile collision/damage handlers.

Observed aggregate: 1,824 player laser spawns; 892 hostile laser spawns; 701.82 total pirate HP damage; zero player deaths; zero complete squadron wipes. Some individual trials destroyed one of the two pirates. The test was a stationary-player firing baseline, not a general balance test.

Telemetry correction: the production pirate kill handler resets its `hits` field, so the harness now wraps the actual damage handler to count hit events independently. It also seeds the non-EAI random stream for reproducible visual/gameplay side effects during each trial and asserts that real pirate damage occurs.
