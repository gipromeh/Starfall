# Civilian Shuttle B

- Runtime role: civilian traffic / trader freighter variant 0.
- Source: NASA 3D Resources, Space Shuttle (B).
- Geometry: 2,476 triangles, 1 material, no embedded textures (GLB metadata inspection).
- Runtime normalization: longest local axis aligned to -Z, centered, 70 world units long; cached as a shared geometry/material source and cloned by the existing freighter cache.
- Failure behavior: existing procedural freighter remains active if the GLB fails to load or normalization throws.
- Mobile budget: below the 9,000-triangle ship target; no runtime texture upload.

The model is used only for civilian traffic. It does not replace the player ship or pirate combatants.
