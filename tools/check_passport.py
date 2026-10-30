#!/usr/bin/env python3
"""Проверка паспорта: SHA-256 STARFALL_CURRENT.html должен совпадать с main_file_sha256.
python3 tools/check_passport.py        — проверить (код 1 при расхождении)
python3 tools/check_passport.py --fix  — обновить SHA и last_update в паспорте
"""
import hashlib, re, sys, datetime, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
game = root / "STARFALL_CURRENT.html"
pp = root / "STARFALL_PASSPORT.md"
sha = hashlib.sha256(game.read_bytes()).hexdigest()
text = pp.read_text(encoding="utf-8")
m = re.search(r'^main_file_sha256:\s*"([^"]*)"', text, re.M)
if not m:
    sys.exit("В паспорте нет поля main_file_sha256")
if not re.search(r'^game_version:\s*"v\d+', text, re.M):
    sys.exit("В паспорте нет поля game_version")
if "--fix" in sys.argv:
    text = text.replace(m.group(0), 'main_file_sha256: "%s"' % sha)
    text = re.sub(r'^last_update:.*$', 'last_update: %s' % datetime.date.today().isoformat(), text, flags=re.M)
    pp.write_text(text, encoding="utf-8")
    print("Паспорт обновлён, SHA-256:", sha)
elif m.group(1) != sha:
    sys.exit("SHA-256 игры (%s) не совпадает с паспортом (%s): обновите паспорт и CHANGELOG, затем python3 tools/check_passport.py --fix" % (sha, m.group(1)))
else:
    print("OK, SHA-256:", sha)
