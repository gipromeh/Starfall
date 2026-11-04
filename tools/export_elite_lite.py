#!/usr/bin/env python3
"""Create a compact, deterministic, GitHub-sized system-navigation dataset from Spansh."""
from __future__ import annotations
import argparse, gzip, hashlib, json, math, os, random, sys
from pathlib import Path
from typing import Any, Iterator

def records(path: Path) -> Iterator[dict[str, Any]]:
    try:
        import ijson
    except ImportError as exc:
        raise RuntimeError("Install dependencies: pip install -r requirements-data.txt") from exc
    opener = gzip.open if path.suffix.lower() == ".gz" else open
    with opener(path, "rb") as stream:
        yield from ijson.items(stream, "item", use_float=True)

def compact(item: dict[str, Any]) -> dict[str, Any] | None:
    coords = item.get("coords") or {}
    x, y, z = (coords.get(k) for k in ("x", "y", "z"))
    name, id64 = item.get("name"), item.get("id64")
    if id64 is None or not isinstance(name, str) or not all(
        isinstance(v, (int, float)) and math.isfinite(v) for v in (x, y, z)
    ):
        return None
    row = {"id": str(id64), "n": name, "x": round(x, 2), "y": round(y, 2), "z": round(z, 2)}
    for source, target in (
        ("population", "p"), ("allegiance", "a"), ("government", "g"),
        ("security", "s"), ("primaryEconomy", "e"), ("secondEconomy", "e2"),
        ("controllingFaction", "f"), ("bodyCount", "bc")
    ):
        value = item.get(source)
        if value not in (None, "", 0):
            row[target] = value
    return row

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path("data/elite-dangerous-lite/systems.jsonl.gz"))
    parser.add_argument("--max-systems", type=int, default=50000)
    parser.add_argument("--max-mb", type=float, default=35.0)
    parser.add_argument("--inhabited-only", action="store_true")
    parser.add_argument("--seed", type=int, default=20261104)
    args = parser.parse_args()
    if args.max_systems < 1 or args.max_mb <= 0:
        parser.error("max-systems and max-mb must be positive")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    temp = args.output.with_suffix(args.output.suffix + ".part")
    rng = random.Random(args.seed)
    sample: list[dict[str, Any]] = []
    eligible = skipped = 0
    digest = hashlib.sha256()
    try:
        # Reservoir sampling gives broad coverage across the source instead of taking
        # an alphabetically biased prefix. Memory is bounded by --max-systems.
        for item in records(args.source):
            row = compact(item)
            if row is None:
                skipped += 1
                continue
            if args.inhabited_only and not row.get("p"):
                continue
            eligible += 1
            if len(sample) < args.max_systems:
                sample.append(row)
            else:
                index = rng.randrange(eligible)
                if index < args.max_systems:
                    sample[index] = row

        sample.sort(key=lambda row: (row["n"].casefold(), row["id"]))
        with gzip.open(temp, "wt", encoding="utf-8", compresslevel=9, newline="\n") as out:
            for row in sample:
                out.write(json.dumps(row, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n")
        size = temp.stat().st_size
        limit = int(args.max_mb * 1024 * 1024)
        if size > limit:
            raise RuntimeError(f"Output {size:,} bytes exceeds budget {limit:,}; lower --max-systems")
        os.replace(temp, args.output)
        with args.output.open("rb") as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                digest.update(chunk)
        manifest = {
            "format": "starfall-systems-jsonl-v1", "source": args.source.name,
            "eligible_records": eligible, "records": len(sample), "invalid_records_skipped": skipped,
            "compressed_bytes": size, "sha256": digest.hexdigest(), "sample_seed": args.seed,
            "selection": "deterministic reservoir sample" + ("; inhabited only" if args.inhabited_only else ""),
            "complete_galaxy": False
        }
        args.output.with_suffix(args.output.suffix + ".manifest.json").write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        print(json.dumps(manifest, ensure_ascii=False, indent=2))
        return 0
    except Exception:
        temp.unlink(missing_ok=True)
        raise

if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, RuntimeError, ValueError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
