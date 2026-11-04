# NASA GLB import validation

**Branch:** `assets/free-space-glb-pack`  
**Validation date:** 2026-11-04  
**Scope:** 17 newly imported NASA GLB files.

## Results

- 17/17 files: GLB magic, version 2 and declared file length valid.
- 17/17 files: JSON chunk parses.
- 17/17 files: bufferView ranges, accessor references, primitive attribute/index/material references and node-to-mesh references pass structural checks.
- No source GLB files were modified.
- This is structural validation only. It does not prove visual correctness, correct scale/orientation in the game, texture appearance, WebGL compatibility, GPU memory behavior or stable iPhone frame time.

## Imported model inventory

| Model | Size, bytes | Triangles | Meshes | Materials | Images |
|---|---:|---:|---:|---:|---:|
| 1999 RQ36 asteroid | 329,596 | 18,240 | 1 | 2 | 0 |
| ISS B | 476,992 | 174,440 | 10 | 19 | 0 |
| Base Station | 21,752 | 184 | 1 | 2 | 1 |
| Apollo Lunar Module | 716,840 | 97,588 | 134 | 12 | 6 |
| Argo | 42,572 | 9,221 | 1 | 8 | 0 |
| Shuttle Payload | 516,016 | 2,487 | 1 | 6 | 1 |
| TESS satellite | 206,576 | 18,314 | 2 | 10 | 0 |
| NEAR Shoemaker | 701,808 | 9,312 | 4 | 4 | 6 |
| Earth Observing-1 | 224,580 | 37,775 | 10 | 75 | 0 |
| Geostationary satellite | 335,620 | 40,935 | 1 | 24 | 0 |
| Mars Global Surveyor | 53,352 | 19,314 | 1 | 1 | 0 |
| Mars rover Opportunity | 36,668 | 3,845 | 1 | 9 | 0 |
| Cassini-Huygens | 413,640 | 9,199 | 306 | 306 | 0 |
| Explorer Jupiter-C | 149,372 | 8,933 | 23 | 7 | 4 |
| Space Shuttle B | 11,348 | 2,476 | 1 | 1 | 0 |
| Space Shuttle C | 26,132 | 4,999 | 1 | 1 | 0 |
| Cluster probe | 148,336 | 12,380 | 1 | 20 | 0 |

## Runtime status

- **Active:** Argo (45% traffic selection when loaded), Shuttle Payload as an Argo cargo module, Space Shuttle B (30% when loaded), Base Station module (decorative station attachment), 1999 RQ36 as a non-mineable asteroid landmark.
- **Fallback:** existing procedural freighters remain active for remaining traffic and if NASA GLBs fail to load.
- **Active decorative landmark:** 1999 RQ36 asteroid (one model, 18,240 triangles); it is not mineable and is excluded from the gameplay rock/collision array.
- **Staged:** ISS B, remaining probes/landers/shuttles and cargo models.
- **Not implemented:** the five-unit Civilian Research Caravan descriptor is reference data only; no new planet or galaxy GLB was imported.

## Mobile constraints

ISS B (174,440 triangles), Apollo Lunar Module (97,588 triangles), Geostationary satellite (40,935 triangles, 24 materials), Earth Observing-1 (75 materials) and Cassini-Huygens (306 meshes/materials) are not enabled in the primary mobile scene. Evaluate LOD, material consolidation, texture budgets and draw-call impact before runtime use.
