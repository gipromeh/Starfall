# TIE Fighter — TIE/ln

**ID:** `tie_fighter_001`  
**Faction:** `empire`  
**Type:** fighter  
**Status:** procedural viewer; GLB export is not available yet.

## Files

- `index.html` — standalone Three.js viewer and procedural model source.
- `config.json` — asset metadata and viewer capabilities.
- `textures/` — reserved for exported texture maps.
- `animations/` — reserved for reusable animation assets.
- `preview.png` — reserved for an actual rendered preview.
- `model.glb` — reserved for a future GLB export.

The model is currently generated at runtime. Do not create empty placeholder files for GLB, textures, animations, or preview. Keep the viewer self-contained until a real export pipeline is implemented.

## Runtime

Three.js 0.128.0 is loaded from jsDelivr CDN. The viewer is independent of the main STARFALL game loop.
