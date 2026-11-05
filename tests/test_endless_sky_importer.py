#!/usr/bin/env python3
import importlib.util
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "tools" / "import_endless_sky.py"
SPEC = importlib.util.spec_from_file_location("import_endless_sky", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)

class ImporterTests(unittest.TestCase):
    def test_base_ship_variant_and_loadout(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            data = root / "data" / "human"
            data.mkdir(parents=True)
            (data / "ships.txt").write_text(
                'ship "Test Frigate"\n'
                '\tattributes\n\t\tcategory "Medium Warship"\n'
                '\t\t"mass" 120\n\t\t"shields" 900\n'
                '\t\t"hull" 400\n\t\t"drag" 2.5\n'
                '\tengine 0 10\n\tgun 0 -5 "Test Gun"\n'
                '\tturret 0 2 "Test Turret"\n'
                '\toutfits\n\t\t"Test Engine" 2\n'
                'ship "Test Frigate" "Test Frigate (Cargo)"\n'
                '\tadd attributes\n\t\t"mass" 10\n'
                '\t\t"cargo space" 40\n', encoding="utf-8")
            result = MODULE.import_ships(root)
            self.assertEqual(result["shipCount"], 2)
            base, variant = result["ships"]
            self.assertEqual(base["attributes"]["mass"], 120)
            self.assertEqual(base["attributes"]["shield_hp"], 900)
            self.assertEqual(base["hardpoints"]["engines"], 1)
            self.assertEqual(base["hardpoints"]["guns"], 1)
            self.assertEqual(base["hardpoints"]["turrets"], 1)
            self.assertEqual(base["default_loadout"][0]["quantity"], 2)
            self.assertEqual(variant["attributes"]["mass"], 130)
            self.assertEqual(variant["attributes"]["cargo_capacity"], 40)
            self.assertEqual(variant["hardpoints"]["guns"], 1)

    def test_deprecated_data_is_skipped(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            current, old = root / "data" / "human", root / "data" / "_deprecated"
            current.mkdir(parents=True)
            old.mkdir(parents=True)
            (current / "ships.txt").write_text('ship "Current"\n', encoding="utf-8")
            (old / "deprecated ships.txt").write_text('ship "Old"\n', encoding="utf-8")
            result = MODULE.import_ships(root)
            self.assertEqual([x["name"] for x in result["ships"]], ["Current"])

if __name__ == "__main__":
    unittest.main()
