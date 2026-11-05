# Endless Sky ship-data adapter

Starfall can use Endless Sky as an independent reference dataset for ship roles,
mass, drag, shields, hull, capacities, heat dissipation, hardpoint counts and
default outfits. These are Endless Sky game-balance values, not real-world
spacecraft measurements and not Elite Dangerous specifications.

## Licensing boundary

- Upstream: https://github.com/endless-sky/endless-sky
- Upstream source and data files are marked GPL-3.0-or-later in the upstream
  copyright metadata. Artwork has separate per-file licenses.
- This adapter copies no artwork, sounds, sprites or executable code.
- The importer reads a local upstream checkout and writes generated JSON under
  `.local/research/endless-sky/`, ignored by Git.
- Do not move generated data into public builds or commit it without reviewing
  GPL obligations and Starfall's distribution model.

## Import

1. Clone upstream outside the Starfall repository:
   `git clone https://github.com/endless-sky/endless-sky.git ../endless-sky-source`
2. Run from the Starfall root:
   `python3 tools/import_endless_sky.py --source ../endless-sky-source`
3. Generated file:
   `.local/research/endless-sky/ships.json`

Use `--output /path/to/ships.json` to select another destination.

The importer preserves faction, source file and line, ship attributes, hardpoint
counts and stock outfit lists. Deprecated ship definitions are excluded.
It does not alter the live game catalogue or gameplay parameters.

## Integration contract

Imported records are a reference layer, not replacements for Starfall GLBs.
Future mapping must use an explicit Starfall-owned mapping table. Never match
ships by visual similarity or silently overwrite balance values. Existing GLB
assets, AI, combat, save data and fallback models remain authoritative until
each mapping is reviewed and tested.
