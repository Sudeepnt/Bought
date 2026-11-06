"""Copies every SQLite database in pipeline/data (subscribers, the desk, the news) plus the admin secrets into one dated
folder, using SQLite's own backup so a copy taken while the server writes is still consistent. Keeps the newest --keep.

  python deploy/backup.py /srv/bought/backups --keep 14
"""
import argparse
import os
import shutil
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def backup(data: Path, dest_root: Path, keep: int, now: datetime) -> Path:
    dest = dest_root / now.strftime("%Y-%m-%dT%H%M%SZ")
    dest.mkdir(parents=True, exist_ok=True)       # a second run in the same second refreshes that copy
    os.chmod(dest, 0o700)
    for db in sorted(data.glob("*.db")):
        src = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
        out = sqlite3.connect(dest / db.name)
        with out:
            src.backup(out)
        src.close()
        out.close()
    for name in ("admin_password.txt", "admin_session_key", "translations.json"):
        if (data / name).exists():
            shutil.copy2(data / name, dest / name)
    for old in sorted(p for p in dest_root.iterdir() if p.is_dir())[:-keep]:
        shutil.rmtree(old)
    return dest


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("dest")
    ap.add_argument("--keep", type=int, default=14)
    ap.add_argument("--data", default=os.environ.get("BOUGHT_DATA") or str(ROOT / "pipeline" / "data"))
    a = ap.parse_args()
    print(backup(Path(a.data), Path(a.dest), max(1, a.keep), datetime.now(timezone.utc)))
    sys.exit(0)
