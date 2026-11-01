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
- Existing ship classes, acceleration limits, HP, shields, weapons, projectile collision and damage.
- Trading, equipment purchases, station interactions and SAVE 2.0.
- v89 opening pirate formation, firing ranges and attack-pass corrections; both ordinary E/E2 pirates and the opening fleet now share the OCS steering/integration controller.
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
- NPC position and velocity continue integrating between decision ticks.
- Local right/up/forward projections are orthogonal for the canonical forward basis.
- Equal PRNG seeds produce equal decision sequences.
- Better forward alignment and shorter range increase fire probability.
- Existing pirate attack-pass, firing-socket and collision regressions remain green.

## Research integrity

The Elite passport distinguishes facts supported by the annotated 128K listing from hypotheses and unknowns. STARFALL must preserve that distinction. In particular, physical conversions to m/s, exact player missile-lock geometry and exact player laser behavior must not be represented as recovered facts unless separately verified.
