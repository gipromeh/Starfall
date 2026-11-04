# Orbital stations

Imported NASA models:

- `base_station_nasa/model.glb` — runtime-integrated as a low-poly docking module attached to the procedural orbital station (184 triangles, 2 materials, 1 embedded image). Visual decoration only; station collision and docking logic remain unchanged.
- `iss_nasa/model.glb` — staged, not runtime-integrated (36 meshes, approximately 174,440 triangles). Too expensive to enable indiscriminately on mobile without LOD/optimization.

Sources and license guidance: ../SPACE_ASSET_CREDITS.md.
