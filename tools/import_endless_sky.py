#!/usr/bin/env python3
"""Import ship specifications from a local Endless Sky source checkout."""
from __future__ import annotations
import argparse, json, re, subprocess
from pathlib import Path

TOKEN_RE = re.compile(r'"([^"]*)"|\x60([^\x60]*)\x60|([^\s#]+)')
FIELDS = {
    "category": "category", "cost": "cost", "shields": "shield_hp",
    "hull": "hull_hp", "required crew": "required_crew", "bunks": "bunks",
    "mass": "mass", "drag": "drag", "heat dissipation": "heat_dissipation",
    "fuel capacity": "fuel_capacity", "cargo space": "cargo_capacity",
    "outfit space": "outfit_capacity", "weapon capacity": "weapon_capacity",
    "engine capacity": "engine_capacity"
}
NUMERIC = set(FIELDS.values()) - {"category"}

def tokenize(line):
    return [next((part for part in match.groups() if part is not None), "")
            for match in TOKEN_RE.finditer(line)]

def parse_nodes(path):
    nodes = []
    for number, raw in enumerate(path.read_text(encoding="utf-8-sig").splitlines(), 1):
        stripped = raw.lstrip(" \t")
        if not stripped or stripped.startswith("#"):
            continue
        indent = len(raw) - len(stripped)
        parts = tokenize(stripped)
        if parts:
            nodes.append((indent, parts, number))
    return nodes

def children(nodes, index):
    indent = nodes[index][0]
    result = []
    for i in range(index + 1, len(nodes)):
        if nodes[i][0] <= indent:
            break
        if nodes[i][0] == indent + 1:
            result.append(i)
    return result

def number_or_text(value):
    try:
        n = float(value)
        return int(n) if n.is_integer() else n
    except (TypeError, ValueError):
        return value

def read_attributes(nodes, index, base_attributes=None):
    result = {}
    for child in children(nodes, index):
        tokens = nodes[child][1]
        if tokens[0] != "attributes" and tokens[:2] != ["add", "attributes"]:
            continue
        additive = tokens[0] == "add"
        for item_index in children(nodes, child):
            item = nodes[item_index][1]
            key = item[0]
            if key not in FIELDS or len(item) < 2:
                continue
            field = FIELDS[key]
            value = number_or_text(item[1])
            if additive and field in NUMERIC and isinstance(value, (int, float)):
                result[field] = (base_attributes or {}).get(field, 0) + result.get(field, 0) + value
            else:
                result[field] = value
    return result

def read_details(nodes, index):
    hardpoints = {"guns": 0, "turrets": 0, "engines": 0, "fighter_bays": 0}
    loadout = []
    for child in children(nodes, index):
        key = nodes[child][1][0]
        if key in ("gun", "turret", "engine", "bay"):
            target = {"gun": "guns", "turret": "turrets",
                      "engine": "engines", "bay": "fighter_bays"}[key]
            hardpoints[target] += 1
        elif key == "outfits":
            for outfit_index in children(nodes, child):
                item = nodes[outfit_index][1]
                quantity = number_or_text(item[1]) if len(item) > 1 else 1
                if not isinstance(quantity, (int, float)):
                    quantity = 1
                loadout.append({"name": item[0], "quantity": quantity})
    return hardpoints, loadout

def slug(value):
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-") or "unnamed"

def revision(source):
    try:
        return subprocess.check_output(
            ["git", "-C", str(source), "rev-parse", "HEAD"],
            text=True, stderr=subprocess.DEVNULL
        ).strip()
    except (OSError, subprocess.CalledProcessError):
        return None

def import_ships(source):
    data = source / "data" if (source / "data").is_dir() else source
    files = sorted(p for p in data.rglob("*ships.txt") if "_deprecated" not in p.parts)
    if not files:
        raise SystemExit(f"No *ships.txt files found under {data}")
    ships, bases = [], {}
    for path in files:
        relative = path.relative_to(data).as_posix()
        faction = path.parent.name
        nodes = parse_nodes(path)
        for i, node in enumerate(nodes):
            indent, parts, line = node
            if indent or parts[0] != "ship" or len(parts) < 2:
                continue
            model = parts[1]
            variant = parts[2] if len(parts) > 2 else None
            key = (relative, model)
            base = bases.get(key, {})
            attrs = dict(base.get("attributes", {})) if variant else {}
            attrs.update(read_attributes(nodes, i, attrs))
            hardpoints, loadout = read_details(nodes, i)
            if variant:
                for field, count in hardpoints.items():
                    if not count:
                        hardpoints[field] = base.get("hardpoints", {}).get(field, 0)
                if not loadout:
                    loadout = list(base.get("default_loadout", []))
            name = variant or model
            entry = {
                "id": "endless-sky-" + slug(faction) + "-" + slug(model) +
                      ("-" + slug(variant) if variant else ""),
                "name": name, "model_name": model, "variant": variant,
                "faction": faction, "category": attrs.get("category"),
                "attributes": attrs, "hardpoints": hardpoints,
                "default_loadout": loadout,
                "source": {
                    "project": "Endless Sky",
                    "repository": "https://github.com/endless-sky/endless-sky",
                    "file": relative, "line": line,
                    "license": "GPL-3.0-or-later"
                }
            }
            ships.append(entry)
            if not variant:
                bases[key] = entry
    ships.sort(key=lambda x: (x["faction"], x["model_name"], x["variant"] or ""))
    return {
        "schemaVersion": 1,
        "source": {
            "name": "Endless Sky",
            "repository": "https://github.com/endless-sky/endless-sky",
            "license": "GPL-3.0-or-later",
            "revision": revision(source),
            "data_files": len(files),
            "notice": "Local research import; no artwork or executable code included."
        },
        "shipCount": len(ships), "ships": ships
    }

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, type=Path,
                        help="Local Endless Sky repository checkout")
    parser.add_argument("--output", type=Path,
                        default=Path(".local/research/endless-sky/ships.json"))
    args = parser.parse_args()
    source = args.source.resolve()
    if not source.exists():
        raise SystemExit(f"Source directory does not exist: {source}")
    result = import_ships(source)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n",
                           encoding="utf-8")
    print(f"Imported {result['shipCount']} ship definitions from {result['source']['data_files']} files.")
    print(f"Output: {args.output.resolve()}")
    print("Generated data stays local and is not intended for Git commits or public deployment.")

if __name__ == "__main__":
    main()
