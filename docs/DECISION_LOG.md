# STARFALL — Decision Log

## 2026-11-01 — Explicit replacement of the production HTML baseline
- User explicitly selected the uploaded `STARFALL — Void Hunter.html` as a full replacement for `STARFALL_CURRENT.html`.
- The exported outer wrapper was stripped; the inner standalone HTML document was committed as the game entry file.
- This intentionally replaces the previous v90 implementation. Historical v89/v90 passport and research notes remain archival and must not be interpreted as proof that those systems exist in the replacement build.
- Local validation: all inline JavaScript blocks passed `node --check`. CI, gameplay regression, SAVE migration/compatibility, and physical iPhone Safari validation are pending.
- Status: IMPLEMENTED, NOT VERIFIED.


Canonical record of durable gameplay, architecture, UI and workflow decisions. New entries are appended at the top. Statuses distinguish an accepted design decision from a verified implementation.

## 2026-11-01 — Elite OCS controller integration (implementation pending CI)
- Decision: use one shared OCS-style tactical controller for ordinary E/E2 pirates and the opening pirate fleet; preserve per-ship balance, weapons, HP, collision and SAVE behavior.
- Decision: tactical decisions run at 15 Hz with per-frame orientation/velocity/position integration; slot phase offsets stagger decision ticks.
- Decision: derive steering commands from normalized target vectors projected onto local OCS axes; keep discrete yaw/pitch/acceleration commands and gate NPC fire by orientation, range and seeded PRNG.
- Implemented in STARFALL_CURRENT.html commit b4c096a; acceptance tests added in tests/t11_pirate_fleet.js commits f26d375 and da87fa9.
- Status: NOT ACCEPTED AS COMPLETE. Browser CI for head da87fa9 is pending; exact Elite byte-level controller is not claimed; browser regression and balance review remain required.

## 2026-11-01 — Scanner HUD placement
- Decision: the СКАНЕР opener belongs in the upper-right safe area; the circular radar retains the lower-left area.
- Decision: change placement only; preserve scanner panel behavior and controls.
- Implemented in STARFALL_CURRENT.html commit 59fbf0e; regression updated in tests/t16_deep_space.js commit 1a1a310.
- Status: quick/static checks passed on the preceding run; browser verification was pending at the time.

## Permanent project rules
- GitHub repository gipromeh/Starfall is the canonical project record. A decision is not safely captured until committed to the repository.
- Every game-code change must update STARFALL_PASSPORT.md and CHANGELOG.md in the same work sequence; update research mapping documents when algorithmic claims change.
- Record decisions with rationale, scope, constraints, acceptance criteria and status (proposed, implemented, verified, rejected); never label untested work as verified.
- Keep main unchanged and do not merge a PR unless the user explicitly authorizes it.
