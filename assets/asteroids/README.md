# Asteroids

- `1999_rq36/model.glb` — imported NASA asteroid model, 329,596 bytes, 18,240 triangles, 1 glTF mesh and 2 materials.
- Status: staged, not runtime-integrated. The current mining/collision loop expects a single Three.js mesh with the game's rock metadata and mining material contract; the GLB's multi-material structure needs an adapter before it can replace a mineable rock.
- Existing procedural asteroid belt remains active. No mining, collision or asteroid-spawn behavior was changed.

Source and license guidance: ../SPACE_ASSET_CREDITS.md.
