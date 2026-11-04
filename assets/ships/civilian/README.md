# Civilian spacecraft library

14 NASA GLB models are imported for civilian traffic, cargo scenes, probes, landers and escort groups.

## Runtime-integrated

- `argo/model.glb` — used by the main game's neutral civilian traffic. Its long axis is aligned to STARFALL local -Z and normalized to 98 game units. The procedural freighter remains the loading/error fallback. Source model: 9,221 triangles, 8 materials, no embedded images.
- `space_shuttle_b/model.glb` — retained in the cafe/ship-visual subsystem as the low-poly Shuttle B variant. Source model: 2,476 triangles.

## Staged, not runtime-integrated

The remaining civilian spacecraft are available for later convoy, cargo, escort and mission-specific integration. Review their orientation, scale, material count and mobile polygon budget before use. The five-unit formation descriptor in `../../convoys/civilian_caravan_001/formation.json` is still a reference layout, not an active runtime convoy.

Sources and attribution: ../../SPACE_ASSET_CREDITS.md.
