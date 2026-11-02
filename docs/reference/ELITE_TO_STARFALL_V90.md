# Elite research → STARFALL implementation map

**Source:** `docs/reference/ELITE_GAME_PASSPORT.md`, revision 0.4, ZX Spectrum 128K research passport.  
**Target:** `STARFALL_CURRENT.html`, browser game, Three.js r128.  
**Rule:** transfer verified gameplay structures and algorithms; do not copy undocumented values or the original machine's coordinate scale into STARFALL.

## Implemented in v90

| Research finding | Elite passport location | STARFALL implementation |
|---|---|---|
| AI decision and movement are separate loops; ordinary NPC decisions occur once per four frames | §§5.2, 13.6, 14.4 | `EAI.think()`: tactical decision tick at 15 Hz; steering and position integration remain per rendered simulation frame |
| Ship orientation is a local basis; target direction is projected onto its axes | §§5.1, 13.2, 13.4, 14.3, 14.7 | `EAI.projectOCS()`: normalized relative vector, half-scale and inverted dot products on right/up/forward axes |
| NPC steering uses discrete OCS commands; movement is a separate pass | §§13.5–13.7, 14.7, 14.12 | `EAI.command()` quantizes yaw/pitch and acceleration on the 15 Hz decision tick; `EAI.integrate()` applies local-axis rotation, speed limits and position integration every frame |
| NPC fire uses orientation gates, distance and a descriptor probability | §§13.9, 14.11 | `EAI.fireGate()`: sign-XOR, projection and range gates precede the seeded PRNG threshold; `EAI.fireChance()` supplies the adapted descriptor probability |
| Random AI decisions share a reproducible sequence | §§5.4, 14.12–14.14 | Shared xorshift32 AI stream, seeded from system/wave/score; visual randomness remains separate |

## Existing STARFALL systems retained

- Three-dimensional flight and quaternion orientation.
- Existing ship classes, acceleration limits, HP, shields, weapons, projectile collision and damage. Bosses use the same flight controller with separate tuning and boss-specific attack patterns.
- Trading, equipment purchases, station interactions and SAVE 2.0.
- The previous scripted APPROACH/ATTACK/LOOP/BREAK and ATTACK_RUN/FIRING_PASS/OVERSHOOT waypoint state machines have been removed from ordinary pirates and the opening fleet. Both now use one OCS pilot controller with component-wise proximity reaction, ATTACK/EVADE intent selection, deterministic lateral bias, incoming-projectile reaction, 15 Hz tactical decisions and per-frame inertial integration.
- Mobile quality profiles, WebGL lifecycle handling and touch controls.

## Deliberately not copied literally

- Elite's 24-bit signed-magnitude coordinates, Z80 fixed-point tables and byte-level object-slot layout.
- Elite's exact speed units, 50 Hz machine timing and ship descriptor bytes.
- Exact original missile lock/range/dwell parameters: the research passport explicitly marks some player lock-on details as unconfirmed.
- A bit-exact clone of Elite's PRNG stream or its original binary behavior.

STARFALL uses Three.js world units and its existing simulation scale. The v90 AI is a structural adaptation, not an emulator.

## Remaining research-derived design backlog

| Area | Research direction | STARFALL work required |
|---|---|---|
| Navigation | System map, distance calculation, fuel-limited jump range | Replace the small destination shortlist with a navigable procedural system map and explicit range/fuel checks |
| Galaxy | Eight galaxies with 256 algorithmically generated systems each | Data-driven galaxy/system registry, stable IDs, deterministic generation and save migration |
| Economy | Economy classes, legal/illegal cargo, inter-system price differences | Connect market state, cargo legality, local security and route risk |
| Pilot progression | Long-form combat rating from Harmless to Elite | Derive a named rank from persistent kill statistics and expose it in the station/HUD |
| Equipment | Purchases change actual ship capability | Keep every purchase bound to a measurable ship statistic or active subsystem |
| Missions | Special missions beyond random combat/trading | Add authored mission chains with explicit triggers, state, outcomes and save support |
| Law and factions | Local law, police, bounty hunters and political stability | Introduce system-level legal status and faction reputation before adding enforcement behavior |
| Missile system | Target association, ECM, component-wise hit tests | Review STARFALL's existing missile implementation separately; do not import unconfirmed Elite player-lock values |
| Lore | Separate game implementation from literary context | Keep original STARFALL characters/factions; treat *The Dark Wheel* as research context, not as a claim that its plot is implemented |

## Acceptance tests for the v90 AI layer

- One tactical decision tick per four 60 Hz frames (15 Hz).
- Ordinary pirates and opening squadron use only ATTACK/EVADE intent; no scripted attack-run waypoints or timed loops.
- Component-wise proximity reaction switches to evasion; after separation and a minimum evasion interval the pilot can re-engage.
- Incoming player projectiles can trigger evasion at the next tactical tick.
- Heading changes remain rate-limited and translation remains inertial between decisions.
- NPC position and velocity continue integrating between decision ticks.
- Local right/up/forward projections are orthogonal for the canonical forward basis.
- Equal PRNG seeds produce equal decision sequences.
- Better forward alignment and shorter range increase fire probability.
- Existing pirate attack-pass, firing-socket and collision regressions remain green.

## Research integrity

The Elite passport distinguishes facts supported by the annotated 128K listing from hypotheses and unknowns. STARFALL must preserve that distinction. In particular, physical conversions to m/s, exact player missile-lock geometry and exact player laser behavior must not be represented as recovered facts unless separately verified.


## 2026-11-03 — Shared Elite-derived pilot behavior

- Replaced the hand-authored pirate waypoint/state machines for ordinary E/E2 ships and the opening pirate squadron with one shared pilot intent selector.
- The old `APPROACH/ATTACK/LOOP/BREAK` and `APPROACH/ATTACK_RUN/FIRING_PASS/OVERSHOOT/REPOSITION` movement scripts are removed from these NPC paths.
- The pilot selects `ATTACK` or `EVADE` on the 15 Hz decision tick using local-axis component proximity and incoming-projectile checks. It chooses a target-directed or evasive vector; OCS steering and velocity/position integration continue every simulation frame.
- Existing ship models, sockets, weapons, projectile collision, damage, effects and SAVE are retained. Boss-specific firing patterns and visual presentation remain, while boss flight also uses the shared OCS pilot with wider STARFALL proximity/re-engagement thresholds.
- This is a structural adaptation of the verified Elite 128K decision/OCS/integration principles, not a bit-exact Z80 AI clone. The Elite passport does not establish STARFALL's numeric proximity thresholds, so these remain explicit STARFALL tuning values.
- Regression tests now assert ATTACK/EVADE transitions, continuous heading changes, deterministic pilot intent and removal of legacy scripted states. Full browser CI acceptance is pending.

## 2026-11-01 — Shared OCS controller work in progress

- The shared controller is now used by ordinary E/E2 pirates and the opening `pirateFleet` squadron.
- Tactical commands are refreshed on the 15 Hz decision tick; orientation, velocity and position are integrated each simulation frame. AI clocks receive slot phase offsets.
- The controller calculates half-scale, inverted local-axis projections and derives quantized yaw/pitch/acceleration commands. NPC fire now passes orientation/range gates and a seeded PRNG threshold.
- Regression coverage was extended in `tests/t11_pirate_fleet.js` for projection signs/scale, discrete commands, per-frame integration, fire gates and staggered ticks.
- **Acceptance status: pending.** This is a structural adaptation, not a bit-exact Elite port. Do not claim full research fidelity or balance stability until the complete browser test matrix passes and the attack behavior is reviewed.
