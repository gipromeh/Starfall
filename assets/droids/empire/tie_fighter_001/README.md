# STARFALL — Void Hunter / Abyssal Sentinel

**ID:** `tie_fighter_001` (legacy asset path)  
**Type:** biomechanical drone  
**Status:** procedural Three.js viewer, version 1.1.0

## Visual design

- Sculpted 3D skull with recessed eye sockets, cheek plates, teeth and emissive cranial details.
- Transparent luminous canopy and iridescent organic shell.
- Twelve tapered, animated tentacles with cyan, magenta and crimson filaments.
- Machined twin cannons with animated magenta plasma bolts.
- Compact shoulder armor; the oversized TIE wing plates are no longer part of the rendered silhouette.
- Starfield, cinematic lighting and Unreal Bloom post-processing.

## Runtime

- Three.js 0.128.0
- WebGLRenderer
- OrbitControls
- EffectComposer, RenderPass, UnrealBloomPass
- CDN dependencies; bloom gracefully falls back to direct WebGL rendering if post-processing scripts fail.

## Controls

Drag / touch — orbit  
Wheel / pinch — zoom  
Front / side / top — camera presets  
Spin — automatic turntable  
Wireframe — geometry inspection  
Model scale and lighting — live sliders

## Asset state

The model is procedural and generated at runtime in `index.html`. A production GLB and baked PBR texture set have not been exported. No placeholder model files are used.
