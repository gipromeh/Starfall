# Deep-Space Skybox 1.0

A 360° deep-space sky for games: a dense star field, a dusty galaxy band, faint
nebula clouds and a warm sun. 4096×2048 equirectangular panoramas in Radiance
HDR, plus tone-mapped PNGs for platforms without HDR.

Everything was made from scratch with Blender's procedural shader nodes and
baked with Cycles. No photos, scans, AI images or third-party assets are in it.

**Licence: CC0 1.0** (public domain dedication, see `LICENSE.txt`). Use it in
anything, commercial or not, change it, and you don't have to credit anyone.
Credit is appreciated but not required.

## What's in the folder

```
hdr/deep_space_combined_4k.hdr   the full sky (start here)
png/deep_space_combined_4k.png   the same, tone-mapped (AgX) to 8-bit sRGB
png/deep_space_combined_2k.png   smaller, for mobile
previews/                        camera views and one picture per layer
manifest.json                    every file with size, peak brightness and the sun position
```

The separate layers (stars, galaxy, nebula, sun) are a second download,
`deep-space-skybox-layers-1.0.zip`, so you can rebuild the sky without the sun,
or brighten the nebula, by adding the layers together in a shader.

## Using it

**Unity.** Select `deep_space_combined_4k.hdr`. Set Texture Shape to **Cube**
and Mapping to **Latitude-Longitude Layout (Cylindrical)**, then Apply. Create
a material with the **Skybox/Cubemap** shader, assign the texture, and set it
as the Skybox Material in Window > Rendering > Lighting > Environment.

**Godot 4.** On a WorldEnvironment, set Background Mode to **Sky**, give the
Sky a new **PanoramaSkyMaterial**, and drop the `.hdr` into its Panorama slot.

**three.js.** Load it with `HDRLoader` (`RGBELoader` in older versions), set
`texture.mapping = THREE.EquirectangularReflectionMapping`, and use it as
`scene.background` and `scene.environment`.

**Blender.** World > Surface > Environment Texture, then open the `.hdr`.

## Things to know

- It is a dark sky. The values are scene-linear and the average is low, as
  space should be; raise the sky's exposure or intensity in your engine if you
  want more stars.
- The sun is HDR (peak about 387), so it lights reflective surfaces like a real
  light. If your scene already has a directional light for the sun, use the
  layers without `sun` instead, or keep both and line them up.
- The sun sits about 28° from the image centre and 12° above the horizon.
  Rotate the sky in your engine to put it where your scene needs it.
- The panorama wraps cleanly at the left and right edges. The seam differs less
  than any two neighbouring columns do (`seam_diff` in `manifest.json`).
- There are no cubemap faces in the box. Unity, Godot, three.js and Blender all
  take the equirectangular file directly.

Made by Toolbench, https://toolbenchdev.com/gamedev/cc0-game-assets/
