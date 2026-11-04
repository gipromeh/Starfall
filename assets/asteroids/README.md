# Asteroids

- `1999_rq36/model.glb` — imported NASA asteroid model, 329,596 bytes, 18,240 triangles, 1 glTF mesh and 2 materials.
- **Runtime-integrated:** one 1999 RQ36 model appears as a decorative landmark in the planetary asteroid belt. It is normalized to 44 game units, uses shared GLB geometry/material resources and has shadows disabled.
- **Not mineable / no collision:** the landmark is deliberately excluded from the existing `rocks` array. Mining, collision, HP and respawn continue to use the existing procedural asteroid system.
- If the GLB fails to load, the procedural asteroid belt remains unchanged.

Source and license guidance: ../SPACE_ASSET_CREDITS.md.
