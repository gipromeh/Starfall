# STARFALL — Pirate Strategic AI Production Integration

## Runtime ownership

The production adapter is embedded in `starfall.html` to preserve the current single-page game architecture. It does not create a second NPC or combat simulation.

- `nv[]` remains the authority for live neutral, passenger and trade-route NPCs.
- `nv[].route` supplies the actual route endpoints, direction, speed, cargo and passenger exposure.
- Stable runtime NPC IDs are assigned lazily and scoped to the current system.
- Strategic groups persist independently of Three.js meshes. Their positions, velocity, hull, morale, cargo ledger, raid count and cooldown are plain serializable data.
- `E` and `E2` remain the active pirate combatants. Strategic groups can bind them to a real route NPC through the existing `tn` target and projectile collision path.
- The existing `pirateFleet` remains player-facing combat AI; its slots are mirrored into strategic group records without replacing its flight controller.

## Simulation and combat handoff

Strategic decisions and off-screen movement are bounded per frame. Groups patrol around system planets, score real traffic by cargo/passenger exposure and route risk, intercept a selected NPC, and raid it only outside the active player bubble.

When a group reaches traffic near the player, the adapter hands the encounter to the production combat system:

1. Bind an available `E`/`E2` pirate to the selected `nv[]` object.
2. Let the existing pirate flight controller steer and fire.
3. Let existing hostile projectile collision mark the NPC as pirate-owned.
4. Let `killNv()` apply the established faction/galaxy raid consequence.

Outside the active bubble, the strategic layer applies bounded abstract damage to the same live NPC record. It calls `killNv()` on destruction, so the established raid consequence remains authoritative. Player-owned damage still follows the existing civilian penalty path.

## Persistence

The existing SaveSystem remains version 3. Its payload receives an optional `ps` field:

- all five system strategic ledgers;
- deterministic system seed and NPC serial;
- stable group IDs, role, source, state, ship count, position and velocity;
- hull, morale, cargo, raid/loss counters and cooldown.

Transient Three.js references, active target object references and target NPC IDs are deliberately excluded. They are reacquired from live traffic after load. The validator supplies an empty strategic state when loading an older v3/v2/legacy save without `ps`; existing save slots and checksum format are unchanged.

## Regression

Run the browser integration test:

```sh
node tests/t22_pirate_strategic_integration.js
```

It covers real route NPC selection, off-screen raid resolution, handoff to a production pirate combatant, stable group identity and SaveSystem round-trip. The existing `t11_pirate_fleet.js` and `t1_saves.js` remain required regressions.
