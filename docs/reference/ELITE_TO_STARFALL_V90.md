# Elite research → STARFALL implementation map

**Source:** `docs/reference/ELITE_GAME_PASSPORT.md`, revision 0.4, ZX Spectrum 128K research passport.  
**Target:** `STARFALL_CURRENT.html`, browser game, Three.js r128.  
**Rule:** transfer verified gameplay structures and algorithms; do not copy undocumented values or the original machine's coordinate scale into STARFALL.

## Implemented in v90–v91

| Research finding | Elite passport location | STARFALL implementation |
|---|---|---|
| AI decision and movement are separate loops; ordinary NPC decisions occur once per four frames | §§5.2, 13.6, 14.4 | `EAI.think()`: tactical decision tick at 15 Hz; steering and position integration remain per rendered simulation frame |
| Ship orientation is a local basis; target direction is projected onto its axes | §§5.1, 13.2, 13.4, 14.3, 14.7 | `EAI.projectOCS()`: normalized relative vector, half-scale and inverted dot products on right/up/forward axes |
| NPC steering uses discrete OCS commands; movement is a separate pass | §§13.5–13.7, 14.7, 14.12 | `EAI.command()` quantizes yaw/pitch and acceleration on the 15 Hz decision tick; `EAI.integrate()` applies local-axis rotation, speed limits and position integration every frame |
| NPC fire uses orientation gates, distance and a descriptor probability | §§13.9, 14.11 | `EAI.fireGate()`: sign-XOR, projection and range gates precede the seeded PRNG threshold; `EAI.fireChance()` supplies the adapted descriptor probability |
| Random AI decisions share a reproducible sequence | §§5.4, 14.12–14.14 | Shared xorshift32 AI stream, seeded from system/wave/score; visual randomness remains separate |

## v91 — shared pirate decision controller

| Research finding | Elite passport location | STARFALL implementation |
|---|---|---|
| NPC decisions are distinct from per-frame integration | §§5.2, 13.6, 14.4 | `EAI.pilot()` calls `EAI.decide()` at 15 Hz and `EAI.integrate()` every simulation frame |
| Pursuit uses target-relative vectors projected onto the local OCS basis | §§13.7, 14.7 | All pirate classes share `EAI.profile/decide/command/integrate/pilot`; no bespoke maneuver FSM or waypoint route |
| Elite selects a target vector or its inverse for reaction | §§5.3, 13.7 | STARFALL uses pursuit and a close-range inverted vector with lateral bias to make a turn command observable in its OCS model |
| NPCs can choose attacking/evasive behavior and respond to proximity | §5.3 | The shared controller derives PURSUE/ATTACK/EVADE/SEPARATE modes from current geometry; labels are telemetry, not state transitions |
| Threat and neighbor handling must preserve safe combat spacing | STARFALL adaptation | Predictive projectile closest-approach test triggers evasion; local separation vector prevents ship overlap. These are explicit STARFALL additions, not claims about original Elite |
| Ship descriptors control speed, handling and fire probability | §§5.1, 14.11 | Data-driven class profiles hold speed, acceleration, turn rate, fire range/probability and adaptation thresholds |

**Coverage:** opening `pirateFleet`, regular E/E2 pirates and boss movement use the same controller. The old scripted `APPROACH / ATTACK_RUN / FIRING_PASS / OVERSHOOT / REPOSITION / LOOP / BREAK` states are removed.

**Limits:** profile values, velocity lead, lateral evasion, projectile prediction, separation and the probability curve are STARFALL adaptations. `EAI.command()` does not reproduce the exact byte-level `$F9FA` procedure; the implementation is not a Z80 emulator or a behaviorally identical Elite port.

## Existing STARFALL systems retained

- Three-dimensional flight and quaternion orientation.
- Existing ship classes, acceleration limits, HP, shields, weapons, projectile collision and damage.
- Trading, equipment purchases, station interactions and SAVE 2.0.
- The opening pirate formation, ship models, weapon sockets, projectile damage and collision systems remain; all pirate movement now uses the shared v91 decision controller, with no scripted attack-pass route.
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

## Acceptance tests for the v91 AI layer

- One tactical decision tick per four 60 Hz frames (15 Hz).
- NPC position and velocity continue integrating between decision ticks.
- Local right/up/forward projections are orthogonal for the canonical forward basis.
- Equal PRNG seeds produce equal decision sequences.
- Better forward alignment and shorter range increase fire probability.
- A deterministic 60-second natural-combat simulation covers pursuit, attack, evasion, real firing and safe ship separation.
- The opening fleet and regular E/E2 pirates call the same controller; old scripted maneuver states are absent.
- Existing firing-socket and collision regressions remain green.

## Research integrity

The Elite passport distinguishes facts supported by the annotated 128K listing from hypotheses and unknowns. STARFALL must preserve that distinction. In particular, physical conversions to m/s, exact player missile-lock geometry and exact player laser behavior must not be represented as recovered facts unless separately verified.


## 2026-11-01 — Shared OCS controller baseline (superseded by v91)

- The shared OCS projection/integration layer was introduced for ordinary E/E2 pirates and the opening `pirateFleet` squadron, but the v90 build still retained scripted maneuver states. That hybrid was insufficient and is superseded by the full v91 decision controller.
- Tactical commands are refreshed on the 15 Hz decision tick; orientation, velocity and position are integrated each simulation frame. AI clocks receive slot phase offsets.
- The controller calculates half-scale, inverted local-axis projections and derives quantized yaw/pitch/acceleration commands. NPC fire now passes orientation/range gates and a seeded PRNG threshold.
- Regression coverage was extended in `tests/t11_pirate_fleet.js` for projection signs/scale, discrete commands, per-frame integration, fire gates and staggered ticks.
- **Acceptance status: pending.** This is a structural adaptation, not a bit-exact Elite port. Do not claim full research fidelity or balance stability until the complete browser test matrix passes and the attack behavior is reviewed.


## Elite ZX Spectrum 3D scanner — implementation mapping

The STARFALL HUD now follows the original Elite scanner concept rather than the later Elite Dangerous rotating radar:

- The scanner is a shallow ellipse. Contact X maps to horizontal position; contact Z maps to the point on the ellipse plane; contact Y determines a vertical stalk from that plane to the contact dot.
- In STARFALL local coordinates (`local = inverse(playerQuaternion) * (contactPosition - playerPosition)`): `screenX = cx + x / range * rx`; `baseY = cy + z / range * ry`; `dotY = clamp(baseY - y / range * stalkScale)`.
- A separate compass points to the planet and switches to the station in the near-station zone. A filled marker means ahead; a hollow marker means behind. `S` marks the station approach/safety zone.
- STARFALL uses a fixed 1600-unit per-axis scanner range and current Three.js coordinates. This preserves the original display model but does not claim to reproduce Elite's original fixed-point byte scales.
- Tap/click target selection is disabled. The modern target HUD is passive information: nearest hostile, bearing, elevation, range and closing speed; it does not engage autopilot or combat lock.

References:
- https://elite.bbcelite.com/deep_dives/the_3d_scanner.html
- https://viva-games.ru/game/elite?setlang=es
- https://www.thirdharmoniser.com/elite.html

- Compass mapping: normalize the full local direction; project X and Y onto the compass disc; encode front/behind using the sign of local Z (filled ahead, hollow behind).
