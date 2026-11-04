# Civilian spacecraft library

14 NASA GLB models are imported for civilian traffic, cargo scenes, probes, landers and escort groups.

## Runtime-integrated

- `argo/model.glb` — selected for 45% of neutral traffic spawns when loaded. Its long axis is aligned to STARFALL local -Z and normalized to 98 game units. Source model: 9,221 triangles, 8 materials, no embedded images.
- `shuttle_payload/model.glb` — attached as a cargo module to Argo when its GLB is loaded. The module is aligned to local -Z, normalized to 36 units and scaled to 65% on attachment. Source model: 2,487 triangles, 6 materials, 1 embedded image.
- `space_shuttle_b/model.glb` — selected for the next 30% of neutral traffic spawns when loaded. Its long axis is aligned to local -Z and normalized to 70 game units; the normalized root scale is preserved when cloning. Source model: 2,476 triangles, 1 material, no embedded images.
- Procedural freighters remain the fallback and account for the remaining traffic variants. If either GLB fails to load, the procedural models remain available.

All GLB variants are cloned from cached templates; geometry/material resources are shared. Cast/receive shadows are disabled for the imported civilian models. The runtime integration changes only neutral traffic visuals; HP, hit detection, routes, traffic AI, economy and SAVE remain unchanged.

## Staged, not runtime-integrated

The remaining civilian spacecraft are available for later convoy, cargo, escort and mission-specific integration. Review their orientation, scale, material count and mobile polygon budget before use. The five-unit formation descriptor in `../../convoys/civilian_caravan_001/formation.json` is still a reference layout, not an active runtime convoy.

Sources and attribution: ../../SPACE_ASSET_CREDITS.md.
