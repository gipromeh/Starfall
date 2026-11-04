# Elite Dangerous — external references

This directory pins three upstream repositories as Git submodules. They are reference material, not Starfall runtime dependencies.

## Pinned sources

| Component | Upstream | Pinned revision | License | Intended use |
|---|---|---|---|---|
| EDDN | https://github.com/EDCD/EDDN | 153e62426eb58b6cd23def535cb4b7e1082e777f | BSD-3-Clause | Journal/event schemas, galaxy data exchange protocol and integration research |
| ED3D Galaxy Map | https://github.com/gbiobob/ED3D-Galaxy-Map | 0ad9a554ac6e29b1f336ec1db9876fe8042de912 | MIT | 3D galaxy-map interaction, route display and JSON data model reference |
| EliteNexus | https://github.com/uruskan/EliteNexus | fd61caeeee90d6362c1686ede39a4c6bca60edc4 | GPL-3.0-or-later | Architecture and feature research only; do not copy or link its GPL code into Starfall without a deliberate licensing decision |

## Actual galaxy datasets

The EDDN repository is the network implementation and schemas, not a galaxy dump. Its README explicitly states that the live EDDN service does not retain data or provide an archive. Use these external data providers for datasets:

- Spansh whole-galaxy dumps (systems, bodies and stations): https://www.spansh.co.uk/dumps
- EDSM nightly dumps (snapshot; body coverage is limited to recent days): https://www.edsm.net/en/nightly-dumps
- Historical EDDN message captures: https://edgalaxydata.space/

Dataset size, generation date, format, terms and attribution must be checked before downloading or redistributing. In particular, the full Spansh galaxy dump can be very large. Do not bundle it into the web client; ingest it into a versioned data pipeline and publish compact, spatially partitioned assets.

## Starfall integration constraints

- Keep all three repositories isolated under `external/elite-dangerous/`; do not import their code into the game bundle by default.
- Treat ED3D as a legacy reference (its README targets Three.js r75 and jQuery), not as a production dependency. Reimplement only required ideas using Starfall's current renderer and input systems.
- Use EDDN schemas as protocol references. Any live network client must be opt-in, resilient to schema changes, rate limits and disconnections.
- EliteNexus is GPL-3.0-or-later. Keep it as a separate submodule/reference; do not copy source into Starfall unless the project's distribution/licensing model is reviewed.
- Preserve each upstream license and notices when redistributing source or derived files.

## Checkout

Clone Starfall with submodules:

```bash
git clone --recurse-submodules https://github.com/gipromeh/Starfall.git
```

For an existing checkout:

```bash
git submodule update --init --recursive
```
