#!/usr/bin/env python3
"""Stream Spansh's full Elite Dangerous galaxy dump into an external SQLite store.

The source dump and database must remain outside Git. Requires: pip install -r requirements-data.txt
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import math
import os
import shutil
import sqlite3
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Iterator

USER_AGENT = "STARFALL-Galaxy-Importer/1.0 (+https://github.com/gipromeh/Starfall)"
SECTOR_SIZE_LY = 128.0
BATCH_SIZE_DEFAULT = 500


def sha256_file(path: Path, chunk_size: int = 8 * 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        while chunk := stream.read(chunk_size):
            digest.update(chunk)
    return digest.hexdigest()


def download_dump(url: str, destination: Path, force: bool = False) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    partial = destination.with_suffix(destination.suffix + ".part")
    if destination.exists() and not force:
        print(f"Already downloaded: {destination} ({destination.stat().st_size:,} bytes)")
        print(f"SHA-256: {sha256_file(destination)}")
        return
    if force:
        partial.unlink(missing_ok=True)
        destination.unlink(missing_ok=True)

    offset = partial.stat().st_size if partial.exists() else 0
    headers = {"User-Agent": USER_AGENT, "Accept-Encoding": "identity"}
    if offset:
        headers["Range"] = f"bytes={offset}-"
    request = urllib.request.Request(url, headers=headers)
    try:
        response = urllib.request.urlopen(request, timeout=90)
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Download failed: {exc}") from exc

    status = getattr(response, "status", response.getcode())
    if offset and status != 206:
        response.close()
        partial.unlink(missing_ok=True)
        offset = 0
        request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept-Encoding": "identity"})
        response = urllib.request.urlopen(request, timeout=90)
        status = getattr(response, "status", response.getcode())
    if status not in (200, 206):
        response.close()
        raise RuntimeError(f"Unexpected HTTP status: {status}")

    mode = "ab" if offset and status == 206 else "wb"
    total_header = response.headers.get("Content-Length")
    expected = (offset + int(total_header)) if total_header and status == 206 else (int(total_header) if total_header else None)
    downloaded = offset
    started = time.monotonic()
    try:
        with response, partial.open(mode) as output:
            while True:
                chunk = response.read(8 * 1024 * 1024)
                if not chunk:
                    break
                output.write(chunk)
                downloaded += len(chunk)
                if expected:
                    percent = min(100.0, downloaded * 100.0 / expected)
                    print(f"\r{downloaded:,}/{expected:,} bytes ({percent:.2f}%)", end="", flush=True)
                else:
                    print(f"\r{downloaded:,} bytes", end="", flush=True)
            output.flush()
            os.fsync(output.fileno())
    except Exception:
        print("\nDownload interrupted; rerun the same command to resume.")
        raise

    if expected is not None and downloaded != expected:
        raise RuntimeError(f"Incomplete download: expected {expected} bytes, received {downloaded}")
    os.replace(partial, destination)
    digest = sha256_file(destination)
    destination.with_suffix(destination.suffix + ".sha256").write_text(
        f"{digest}  {destination.name}\n", encoding="utf-8"
    )
    print(f"\nSaved: {destination} ({downloaded:,} bytes, {time.monotonic() - started:.1f}s)")
    print(f"SHA-256: {digest}")


def iter_systems(source: Path) -> Iterator[dict[str, Any]]:
    try:
        import ijson
    except ImportError as exc:
        raise RuntimeError("Missing dependency. Run: python -m pip install -r requirements-data.txt") from exc
    opener = gzip.open if source.suffix.lower() == ".gz" else open
    with opener(source, "rb") as stream:
        # Spansh galaxy dumps are a top-level JSON array. One object is held in memory at a time.
        yield from ijson.items(stream, "item", use_float=True)


def connect_database(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path)
    connection.execute("PRAGMA journal_mode=WAL")
    connection.execute("PRAGMA synchronous=NORMAL")
    connection.execute("PRAGMA temp_store=FILE")
    connection.execute("PRAGMA cache_size=-65536")
    connection.executescript("""
        CREATE TABLE IF NOT EXISTS systems (
            id64 TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            x REAL NOT NULL,
            y REAL NOT NULL,
            z REAL NOT NULL,
            sx INTEGER NOT NULL,
            sy INTEGER NOT NULL,
            sz INTEGER NOT NULL,
            payload TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_systems_sector ON systems(sx, sy, sz);
        CREATE INDEX IF NOT EXISTS idx_systems_name ON systems(name COLLATE NOCASE);
        CREATE TABLE IF NOT EXISTS import_state (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
    """)
    return connection


def import_dump(source: Path, database: Path, batch_size: int) -> None:
    if not source.is_file():
        raise FileNotFoundError(source)
    connection = connect_database(database)
    source_hash = sha256_file(source)
    started = time.monotonic()
    batch: list[tuple[Any, ...]] = []
    processed = inserted = skipped = 0
    upsert = """
        INSERT INTO systems(id64,name,x,y,z,sx,sy,sz,payload)
        VALUES(?,?,?,?,?,?,?,?,?)
        ON CONFLICT(id64) DO UPDATE SET
            name=excluded.name,x=excluded.x,y=excluded.y,z=excluded.z,
            sx=excluded.sx,sy=excluded.sy,sz=excluded.sz,payload=excluded.payload
    """
    try:
        connection.execute(
            "INSERT INTO import_state(key,value) VALUES('status','running') "
            "ON CONFLICT(key) DO UPDATE SET value='running'"
        )
        connection.commit()
        for record in iter_systems(source):
            processed += 1
            try:
                id64 = record.get("id64")
                name = record.get("name")
                coords = record.get("coords") or {}
                x, y, z = coords.get("x"), coords.get("y"), coords.get("z")
                if id64 is None or not isinstance(name, str) or not all(
                    isinstance(value, (int, float)) and math.isfinite(value) for value in (x, y, z)
                ):
                    skipped += 1
                    continue
                sx, sy, sz = (math.floor(value / SECTOR_SIZE_LY) for value in (x, y, z))
                payload = json.dumps(record, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
                batch.append((str(id64), name, x, y, z, sx, sy, sz, payload))
            except (TypeError, ValueError, OverflowError):
                skipped += 1
                continue

            if len(batch) >= batch_size:
                connection.executemany(upsert, batch)
                connection.commit()
                inserted += len(batch)
                batch.clear()
                elapsed = max(time.monotonic() - started, 0.001)
                print(
                    f"\rRead {processed:,} | stored {inserted:,} | skipped {skipped:,} "
                    f"| {processed / elapsed:,.0f} records/s",
                    end="", flush=True
                )

        if batch:
            connection.executemany(upsert, batch)
            connection.commit()
            inserted += len(batch)
        connection.execute(
            "INSERT INTO import_state(key,value) VALUES('source_sha256',?) "
            "ON CONFLICT(key) DO UPDATE SET value=excluded.value", (source_hash,)
        )
        connection.execute(
            "INSERT INTO import_state(key,value) VALUES('records_read',?) "
            "ON CONFLICT(key) DO UPDATE SET value=excluded.value", (str(processed),)
        )
        connection.execute(
            "INSERT INTO import_state(key,value) VALUES('records_skipped',?) "
            "ON CONFLICT(key) DO UPDATE SET value=excluded.value", (str(skipped),)
        )
        connection.execute(
            "INSERT INTO import_state(key,value) VALUES('status','complete') "
            "ON CONFLICT(key) DO UPDATE SET value='complete'"
        )
        connection.commit()
        print(
            f"\nImport complete: read {processed:,}, stored {inserted:,}, "
            f"skipped {skipped:,}; {time.monotonic() - started:.1f}s"
        )
    except Exception:
        connection.execute(
            "INSERT INTO import_state(key,value) VALUES('status','failed') "
            "ON CONFLICT(key) DO UPDATE SET value='failed'"
        )
        connection.commit()
        raise
    finally:
        connection.close()


def query_near(database: Path, x: float, y: float, z: float, radius: float, limit: int) -> None:
    if radius <= 0 or limit < 1:
        raise ValueError("radius and limit must be positive")
    connection = sqlite3.connect(f"file:{database}?mode=ro", uri=True)
    try:
        lo = [math.floor((v - radius) / SECTOR_SIZE_LY) for v in (x, y, z)]
        hi = [math.floor((v + radius) / SECTOR_SIZE_LY) for v in (x, y, z)]
        rows = connection.execute("""
            SELECT id64,name,x,y,z,
                   ((x-?)*(x-?)+(y-?)*(y-?)+(z-?)*(z-?)) AS d2
            FROM systems
            WHERE sx BETWEEN ? AND ? AND sy BETWEEN ? AND ? AND sz BETWEEN ? AND ?
              AND (x-?)*(x-?)+(y-?)*(y-?)+(z-?)*(z-?) <= ?
            ORDER BY d2 LIMIT ?
        """, (
            x,x,y,y,z,z, lo[0],hi[0],lo[1],hi[1],lo[2],hi[2],
            x,x,y,y,z,z,radius*radius,limit
        ))
        for row in rows:
            print(json.dumps({
                "id64": row[0], "name": row[1], "coords": {"x": row[2], "y": row[3], "z": row[4]},
                "distance": math.sqrt(row[5])
            }, ensure_ascii=False))
    finally:
        connection.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="STARFALL full Elite Dangerous galaxy data pipeline")
    commands = parser.add_subparsers(dest="command", required=True)
    download = commands.add_parser("download", help="download/resume the official dump URL")
    download.add_argument("--url", required=True, help="copy the current galaxy.json.gz URL from spansh.co.uk/dumps")
    download.add_argument("--output", type=Path, default=Path("data/elite-dangerous/raw/galaxy.json.gz"))
    download.add_argument("--force", action="store_true")
    ingest = commands.add_parser("import", help="stream a dump into SQLite")
    ingest.add_argument("--source", type=Path, default=Path("data/elite-dangerous/raw/galaxy.json.gz"))
    ingest.add_argument("--database", type=Path, default=Path("data/elite-dangerous/store/galaxy.sqlite3"))
    ingest.add_argument("--batch-size", type=int, default=BATCH_SIZE_DEFAULT)
    near = commands.add_parser("near", help="query systems within a radius (light-years)")
    near.add_argument("--database", type=Path, default=Path("data/elite-dangerous/store/galaxy.sqlite3"))
    near.add_argument("--x", type=float, required=True)
    near.add_argument("--y", type=float, required=True)
    near.add_argument("--z", type=float, required=True)
    near.add_argument("--radius", type=float, default=100.0)
    near.add_argument("--limit", type=int, default=100)
    args = parser.parse_args()

    try:
        if args.command == "download":
            download_dump(args.url, args.output, args.force)
        elif args.command == "import":
            if args.batch_size < 1:
                parser.error("--batch-size must be >= 1")
            import_dump(args.source, args.database, args.batch_size)
        elif args.command == "near":
            query_near(args.database, args.x, args.y, args.z, args.radius, args.limit)
    except (OSError, RuntimeError, sqlite3.Error, ValueError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
