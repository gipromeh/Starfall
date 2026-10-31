# Babylon workspace changelog

## 2026-10-31 — B1 playable combat slice
- Added Babylon.js 7.0 runtime entrypoint and responsive HUD.
- Switched to the version-pinned official Babylon CDN bundle and glTF loader; removed the esm.sh Babylon peer-dependency resolution failure.
- Added inertial FlightModel, desktop/touch input, pointer-lock activation guard and fixed-step simulation.
- Added Yuka pirate steering through FlightModel.
- Added optimized static GLB batching by material, planet, station and starfield.
- Added laser/missile projectiles, homing, swept segment/sphere collision, shield/hull damage, target destruction, +250 CR reward and timed respawn.
- Isolated Babylon progress in `sf_babylon_slice`; v85 SAVE 2.0 slots remain read-only.
- Added Playwright Chromium CI: 5/5 tests PASS (boot/WebGL, flight, combat/respawn, touch HUD, homing missile).
- Root v85 production file and production passport were not modified.
- Physical iPhone Safari, full economy/story parity and hardware performance benchmarks remain pending.
