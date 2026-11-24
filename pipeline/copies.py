"""Keep a copy: everything Bought keeps on its own server, in one zip file, and putting that file back.

What is in a copy (paths relative to the zip):
  data/            pipeline/data: every database (subscribers, the desk, the news, reader counts), pictures, podcasts,
                   translations, job logs. Databases go in as SQLite's own consistent snapshot, checked before they are added.
  out/             pipeline/out: every issue the funnel made (videos, audio, work files), so an issue can be rebuilt or retried
  public/issues/   the published issues the site serves
  public/s/, public/share/   the share pages and cards
  manifest.json    the size and SHA-256 of every file, the row count of every table, and where the copy came from

Never in a copy: the desk's password and session key (they belong to the machine, so putting a copy back never signs you
out or changes the password) and the keys in /etc/bought/bought.env or backend/.env.

Putting a copy back checks every file's hash and every database's integrity before anything changes, then swaps the
folders in. What was there before is kept in restore-points/ until the next import, so an import can be undone.
"""
from __future__ import annotations

import errno
import hashlib
import json
import os
import re
import secrets
import shutil
import socket
import sqlite3
import subprocess
import time
import zipfile
import zlib
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath

from . import desk as dk

FORMAT = 1
KIND = "bought-copy"
MAGIC = b"SQLite format 3\x00"
STORED = {".mp4", ".mp3", ".m4a", ".m4v", ".mov", ".webm", ".ogg", ".opus", ".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif",
          ".woff", ".woff2", ".gz", ".br", ".zst", ".zip", ".onnx", ".bin"}    # already compressed: zipping again only costs time
NEVER = {"admin_password.txt", "admin_session_key"}
SIDE = ("-wal", "-shm", "-journal")
JUNK = {".DS_Store", "Thumbs.db"}
CHUNK = 1 << 20
SPARE = 200 * 1024 * 1024           # never fill the disk to the last byte
POINT = "before-import"


class CopyError(Exception):
    """Something is wrong with a copy, or there is no room: the message is meant for the person at the desk."""


def sections() -> list[tuple[str, Path]]:
    pub = dk.public_dir()
    return [("data", dk.data_dir()), ("out", dk.out_dir()), ("public/issues", pub / "issues"), ("public/s", pub / "s"), ("public/share", pub / "share")]


def roots() -> dict:
    return {"root": str(dk.ROOT), "data": str(dk.data_dir()), "out": str(dk.out_dir()), "public": str(dk.public_dir())}


def home() -> Path:
    """Where uploads, the copy being made and the restore point live. Same disk as the data, so swapping is a rename."""
    path = Path(os.environ.get("BOUGHT_RESTORE") or dk.ROOT / "restore-points")
    path.mkdir(parents=True, exist_ok=True)
    os.chmod(path, 0o700)
    return path


def stamp(now: datetime) -> str:
    return now.astimezone(timezone.utc).strftime("%Y-%m-%dT%H%M%SZ")


def is_db(path: Path) -> bool:
    try:
        with open(path, "rb") as f:
            return f.read(16) == MAGIC
    except OSError:
        return False


def _q(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def _tables(conn) -> dict:
    names = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")]
    return {t: conn.execute(f"SELECT COUNT(*) FROM {_q(t)}").fetchone()[0] for t in names}


def _integrity(conn, label: str) -> None:
    rows = [r[0] for r in conn.execute("PRAGMA integrity_check")]
    if rows != ["ok"]:
        raise CopyError(f"{label} is damaged: {'; '.join(rows[:3])}")


def _copy_db(src: Path, dst: Path) -> None:
    """SQLite's online backup: the reader of src sees one consistent moment, and dst, even a database other connections
    have open, is replaced in one go."""
    a = sqlite3.connect(src, timeout=60)
    b = sqlite3.connect(dst, timeout=60)
    try:
        a.backup(b)
    finally:
        a.close()
        b.close()


def _snapshot(src: Path, dst: Path, label: str) -> dict:
    _copy_db(src, dst)
    conn = sqlite3.connect(dst)
    try:
        conn.execute("PRAGMA journal_mode=DELETE")          # one self-contained file, no -wal next to it
        _integrity(conn, label)
        return _tables(conn)
    finally:
        conn.close()


def _files(section: str, root: Path):
    """Every regular file of a section, in a stable order. Links are skipped, so nothing outside the folder gets in."""
    for dirpath, dirs, files in os.walk(root):
        dirs[:] = sorted(d for d in dirs if not os.path.islink(os.path.join(dirpath, d)))
        for name in sorted(files):
            path = Path(dirpath) / name
            if name in JUNK or name.endswith(SIDE) or path.is_symlink() or not path.is_file():
                continue
            rel = path.relative_to(root).as_posix()
            if section == "data" and rel in NEVER:
                continue
            yield rel, path


def _free(path: Path) -> int:
    while not path.exists():
        path = path.parent
    return shutil.disk_usage(path).free


def _commit() -> str:
    try:
        return subprocess.run(["git", "-C", str(dk.ROOT), "rev-parse", "--short", "HEAD"], capture_output=True, text=True, timeout=5).stdout.strip()
    except (OSError, subprocess.SubprocessError):
        return ""


def _add(z: zipfile.ZipFile, arc: str, path: Path, mtime: float) -> dict:
    info = zipfile.ZipInfo(arc, date_time=time.gmtime(max(mtime, 315532800))[:6])
    info.compress_type = zipfile.ZIP_STORED if Path(arc).suffix.lower() in STORED else zipfile.ZIP_DEFLATED
    info.external_attr = 0o644 << 16
    h, size = hashlib.sha256(), 0
    with open(path, "rb") as src, z.open(info, "w", force_zip64=True) as out:
        while chunk := src.read(CHUNK):
            h.update(chunk)
            out.write(chunk)
            size += len(chunk)
    return {"path": arc, "size": size, "sha256": h.hexdigest(), "mtime": int(mtime)}


def estimate() -> int:
    return sum(p.stat().st_size for name, root in sections() if root.is_dir() for _, p in _files(name, root))


def export(dest: Path, now: datetime) -> dict:
    """Writes the copy to dest and reads it back once to prove every file is whole. Returns the manifest."""
    need = estimate()
    if _free(dest.parent) < need + SPARE:
        raise CopyError(f"Not enough free disk to make the copy: it needs about {size(need + SPARE)}, {size(_free(dest.parent))} is free.")
    entries = []
    tmp = dest.parent / f".snap-{secrets.token_hex(6)}.db"
    try:
        with zipfile.ZipFile(dest, "w", allowZip64=True) as z:
            for section, root in sections():
                if not root.is_dir():
                    continue
                for rel, path in _files(section, root):
                    arc = f"{section}/{rel}"
                    mtime = path.stat().st_mtime
                    if is_db(path):
                        tables = _snapshot(path, tmp, arc)
                        entry = _add(z, arc, tmp, mtime)
                        entry["tables"] = tables
                        tmp.unlink()
                    else:
                        entry = _add(z, arc, path, mtime)
                    entries.append(entry)
            manifest = {"kind": KIND, "format": FORMAT, "made_at": now.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "host": socket.gethostname(),
                        "commit": _commit(), "roots": roots(), "sections": [s for s, _ in sections()], "files": entries}
            z.writestr("manifest.json", json.dumps(manifest, indent=1), compress_type=zipfile.ZIP_DEFLATED)
    except BaseException:
        dest.unlink(missing_ok=True)
        raise
    finally:
        tmp.unlink(missing_ok=True)
    check(dest)
    return manifest


# ---------- reading a copy ----------
def _safe(arc: str, names: list[str]) -> str:
    """The section an entry belongs to; refuses anything that could land outside it."""
    p = PurePosixPath(arc)
    if "\\" in arc or "\x00" in arc or p.is_absolute() or any(part in ("", ".", "..") for part in arc.split("/")):
        raise CopyError(f"The copy has a file with an unsafe name: {arc[:120]}")
    for name in sorted(names, key=len, reverse=True):
        if arc.startswith(name + "/") and len(arc) > len(name) + 1:
            return name
    raise CopyError(f"The copy has a file outside the known folders: {arc[:120]}")


def check(path: Path, into: Path | None = None) -> dict:
    """Proves a copy is whole: a Bought copy of a format this server reads, nothing extra, every file the right size and
    SHA-256. With `into`, also unpacks it there and opens every database to check it."""
    try:
        z = zipfile.ZipFile(path)
    except (zipfile.BadZipFile, OSError):
        raise CopyError("This file is not a Bought copy (not a zip file, or cut short while downloading).") from None
    with z:
        try:
            m = json.loads(z.read("manifest.json"))
        except KeyError:
            raise CopyError("This file is not a Bought copy (it has no manifest.json).") from None
        except ValueError:
            raise CopyError("This copy's manifest.json is damaged.") from None
        if not isinstance(m, dict) or m.get("kind") != KIND:
            raise CopyError("This file is not a Bought copy.")
        if not isinstance(m.get("format"), int) or m["format"] > FORMAT:
            raise CopyError("This copy was made by a newer version of Bought. Update this server first, then import it.")
        names = [s for s in m.get("sections", []) if isinstance(s, str)]
        known = {s for s, _ in sections()}
        if not names or not set(names) <= known:
            raise CopyError("This copy has folders this server doesn't know.")
        listed, total = {}, 0
        for entry in m.get("files", []):
            arc = entry.get("path") if isinstance(entry, dict) else None
            if not isinstance(arc, str) or arc in listed or not isinstance(entry.get("size"), int) or not re.fullmatch(r"[0-9a-f]{64}", str(entry.get("sha256"))):
                raise CopyError("This copy's manifest.json is damaged.")
            _safe(arc, names)
            listed[arc] = entry
            total += entry["size"]
        members = [i for i in z.infolist() if not i.filename.endswith("/")]
        seen = [i.filename for i in members]
        if len(seen) != len(set(seen)):
            raise CopyError("This copy has the same file twice.")
        extra = set(seen) - set(listed) - {"manifest.json"}
        missing = set(listed) - set(seen)
        if extra or missing:
            raise CopyError(f"This copy doesn't match its own list: {len(missing)} file(s) missing, {len(extra)} not listed.")
        if into is not None and _free(into) < total + SPARE:
            raise CopyError(f"Not enough free disk to unpack this copy: it needs about {size(total + SPARE)}, {size(_free(into))} is free.")
        for info in members:
            if info.filename == "manifest.json":
                continue
            entry = listed[info.filename]
            if info.file_size != entry["size"]:
                raise CopyError(f"{info.filename} is the wrong size in this copy.")
            target = None
            if into is not None:
                target = into / info.filename
                if not target.resolve().is_relative_to(into.resolve()):
                    raise CopyError(f"The copy has a file with an unsafe name: {info.filename[:120]}")
                target.parent.mkdir(parents=True, exist_ok=True)
            h, n = hashlib.sha256(), 0
            try:
                with z.open(info) as src, (open(target, "wb") if target else _Null()) as out:
                    while chunk := src.read(CHUNK):
                        h.update(chunk)
                        out.write(chunk)
                        n += len(chunk)
            except (zipfile.BadZipFile, zlib.error, EOFError) as e:
                raise CopyError(f"{info.filename} is damaged in this copy ({type(e).__name__}).") from None
            if n != entry["size"] or h.hexdigest() != entry["sha256"]:
                raise CopyError(f"{info.filename} doesn't match its checksum: the copy is damaged. Nothing was changed.")
            if target is not None:
                os.utime(target, (entry.get("mtime") or time.time(),) * 2)
                if "tables" in entry:
                    conn = sqlite3.connect(target)
                    try:
                        _integrity(conn, info.filename)
                        if _tables(conn) != entry["tables"]:
                            raise CopyError(f"{info.filename} doesn't have the rows its list says.")
                    except sqlite3.DatabaseError as e:
                        raise CopyError(f"{info.filename} can't be opened as a database: {e}") from None
                    finally:
                        conn.close()
        if into is not None:
            for name in names:
                (into / name).mkdir(parents=True, exist_ok=True)
    return m


class _Null:
    def write(self, _):
        pass

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False


def summary(m: dict) -> dict:
    files = {f["path"]: f for f in m.get("files", [])}
    rows = lambda db, table: (files.get(f"data/{db}", {}).get("tables") or {}).get(table)
    published = {p.split("/")[2] for p in files if re.fullmatch(r"public/issues/\d{4}-\d\d-\d\d/issue\.json", p)}
    return {"made_at": m.get("made_at"), "host": m.get("host") or "", "commit": m.get("commit") or "", "files": len(files),
            "bytes": sum(f["size"] for f in files.values()), "stories": rows("news.db", "articles"), "subscribers": rows("desk.db", "subscribers"),
            "issues": len(published), "latest": max(published) if published else None, "databases": sum(1 for f in files.values() if "tables" in f)}


# ---------- putting a copy back ----------
def _move(a: Path, b: Path) -> None:
    b.parent.mkdir(parents=True, exist_ok=True)
    try:
        os.rename(a, b)
    except OSError as e:
        if e.errno != errno.EXDEV:
            raise
        shutil.move(str(a), str(b))                      # another disk: copy, then delete


def _drop_db(path: Path) -> None:
    for p in (path, *(Path(str(path) + s) for s in SIDE)):
        p.unlink(missing_ok=True)


def rewrite_paths(stage: Path, old: dict, new: dict) -> int:
    """A copy from another machine (or folder) names its files by that machine's paths in a few places (job logs,
    picture files the funnel saved). Point them here. Two passes through placeholders, so one replacement can't feed
    the next."""
    pairs = sorted({(old[k].rstrip("/") + "/", new[k].rstrip("/") + "/") for k in ("data", "out", "public", "root")
                    if isinstance(old.get(k), str) and old.get(k) and old[k] != new[k]}, key=lambda p: -len(p[0]))
    if not pairs:
        return 0
    marks = [f"\ue000bought{i}\ue000" for i in range(len(pairs))]   # private-use characters: in no path, and safe inside SQLite
    changed = 0
    for path in sorted(stage.rglob("*")):
        if not path.is_file():
            continue
        if path.suffix == ".json" and path.stat().st_size < 64 * 1024 * 1024:
            text = path.read_text(encoding="utf-8", errors="surrogateescape")
            esc = [(json.dumps(o)[1:-1], json.dumps(n)[1:-1]) for o, n in pairs]
            if any(o in text for o, _ in esc):
                for (o, _), mk in zip(esc, marks):
                    text = text.replace(o, mk)
                for (_, n), mk in zip(esc, marks):
                    text = text.replace(mk, n)
                path.write_text(text, encoding="utf-8", errors="surrogateescape")
                changed += 1
        elif is_db(path):
            conn = sqlite3.connect(path, isolation_level=None)
            try:
                conn.execute("BEGIN")
                for (table,) in conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").fetchall():
                    for col in [r[1] for r in conn.execute(f"PRAGMA table_info({_q(table)})")]:
                        c = _q(col)
                        hit = " OR ".join(f"instr({c}, ?) > 0" for _ in pairs)
                        expr = c
                        for _, mk in zip(pairs, marks):
                            expr = f"replace({expr}, ?, ?)"
                        args = [x for (o, _), mk in zip(pairs, marks) for x in (o, mk)]
                        for (_, n), mk in zip(pairs, marks):
                            expr = f"replace({expr}, ?, ?)"
                            args += [mk, n]
                        cur = conn.execute(f"UPDATE {_q(table)} SET {c} = {expr} WHERE typeof({c})='text' AND ({hit})", args + [o for o, _ in pairs])
                        changed += cur.rowcount
                conn.execute("COMMIT")
            finally:
                conn.close()
    return changed


def _apply(stage: Path, keep: Path, undo: list) -> None:
    """Moves the staged copy in and what was live into `keep`, recording how to step back."""
    for section, live in sections():
        src, old = stage / section, keep / section
        if section != "data":
            if live.exists():
                _move(live, old)
                undo.append(lambda a=old, b=live: _move(a, b))
            src.mkdir(parents=True, exist_ok=True)
            _move(src, live)
            undo.append(lambda a=live, b=src: _move(a, b))
            continue
        # data: the server has its databases open, so they are written into in place by SQLite; the rest is swapped
        live.mkdir(parents=True, exist_ok=True)
        old.mkdir(parents=True, exist_ok=True)
        src.mkdir(parents=True, exist_ok=True)
        staged = {p.name for p in src.iterdir()}
        present = {p.name for p in live.iterdir()}
        for name in sorted(staged | present):
            if name in NEVER or name.endswith(SIDE):
                continue
            s, l, o = src / name, live / name, old / name
            if (s.is_file() and is_db(s)) or (l.is_file() and is_db(l)):
                if l.is_file() and is_db(l):
                    _copy_db(l, o)
                    undo.append(lambda a=o, b=l: _copy_db(a, b))
                    if not s.exists():
                        _drop_db(l)
                elif l.exists():
                    _move(l, o)
                    undo.append(lambda a=o, b=l: _move(a, b))
                if s.exists():
                    existed = l.exists()
                    _copy_db(s, l)
                    if not existed:
                        undo.append(lambda b=l: _drop_db(b))
                continue
            if l.exists() or l.is_symlink():
                _move(l, o)
                undo.append(lambda a=o, b=l: _move(a, b))
            if s.exists():
                _move(s, l)
                undo.append(lambda a=l, b=s: _move(a, b))


def put_back(stage: Path, now: datetime, label: str = POINT, info: dict | None = None) -> Path:
    """Makes the server hold exactly what is in `stage` (a checked, unpacked copy). What it held before becomes the restore
    point. Any failure steps every move back, so the server is never left half-way."""
    base = home()
    keep = base / f".point-{stamp(now)}-{secrets.token_hex(3)}"
    keep.mkdir()
    undo: list = []
    try:
        _apply(stage, keep, undo)
    except BaseException as e:
        failed = []
        for step in reversed(undo):
            try:
                step()
            except Exception as again:                  # keep going: put back as much as possible
                failed.append(again)
        if failed:
            raise CopyError(f"Importing failed ({e}) and stepping back failed too ({failed[0]}). What was there before is in {keep}.") from e
        shutil.rmtree(keep, ignore_errors=True)
        if isinstance(e, CopyError):
            raise
        raise CopyError(f"Importing failed and nothing was changed: {type(e).__name__}: {e}") from e
    (keep / "point.json").write_text(json.dumps({"label": label, "made_at": now.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                                                 "roots": roots(), "replaced_by": info or {}}, indent=1))
    for old in base.iterdir():
        if old.is_dir() and old.name.startswith(("point-", ".staging-")) and old != keep:
            shutil.rmtree(old, ignore_errors=True)
    final = base / f"point-{stamp(now)}"
    if final.exists():
        shutil.rmtree(final, ignore_errors=True)
    os.rename(keep, final)
    shutil.rmtree(stage, ignore_errors=True)
    return final


def restore_point() -> dict | None:
    base = Path(os.environ.get("BOUGHT_RESTORE") or dk.ROOT / "restore-points")
    points = sorted(p for p in base.glob("point-*") if (p / "point.json").exists()) if base.exists() else []
    if not points:
        return None
    meta = json.loads((points[-1] / "point.json").read_text())
    return {**meta, "path": points[-1]}


def import_copy(upload: Path, now: datetime) -> dict:
    """Checks, unpacks, points paths here, puts back. Returns the copy's summary."""
    base = home()
    stage = base / f".staging-{stamp(now)}-{secrets.token_hex(3)}"
    stage.mkdir()
    try:
        m = check(upload, into=stage)
        rewrite_paths(stage, m.get("roots") or {}, roots())
        info = summary(m)
        put_back(stage, now, POINT, info)
        return info
    finally:
        shutil.rmtree(stage, ignore_errors=True)


def undo_import(now: datetime) -> dict:
    point = restore_point()
    if not point:
        raise CopyError("There is no earlier state to go back to.")
    path = point["path"]
    stage = home() / f".staging-{stamp(now)}-{secrets.token_hex(3)}"
    os.rename(path, stage)
    try:
        rewrite_paths(stage, point.get("roots") or {}, roots())
        put_back(stage, now, "before-undo", {"undo_of": point.get("made_at")})
    except BaseException:
        if stage.exists() and not path.exists():
            os.rename(stage, path)
        raise
    return point


def clean(older_than: float = 6 * 3600) -> None:
    """Leftovers of a copy that was being made or uploaded when the server stopped."""
    base = Path(os.environ.get("BOUGHT_RESTORE") or dk.ROOT / "restore-points")
    if not base.exists():
        return
    for p in base.iterdir():
        if p.name.startswith((".export-", ".upload-", ".snap-", ".staging-", ".point-")) and time.time() - p.stat().st_mtime > older_than:
            shutil.rmtree(p, ignore_errors=True) if p.is_dir() else p.unlink(missing_ok=True)


def size(n: int) -> str:
    for unit in ("bytes", "KB", "MB", "GB"):
        if n < 1024 or unit == "GB":
            return f"{n:,.0f} {unit}" if unit == "bytes" else f"{n:,.1f} {unit}"
        n /= 1024
    return f"{n:.1f} GB"
