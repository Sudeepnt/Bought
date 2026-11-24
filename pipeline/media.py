"""Phase 2a: spoken scripts and audio for prime stories (open-source TTS run as an external command)."""
from __future__ import annotations

import hashlib
import logging
import os
import re
import subprocess
import time
from pathlib import Path

from . import db
from .text import spoken_summary

log = logging.getLogger(__name__)

ASSETS_SCHEMA = """
CREATE TABLE IF NOT EXISTS assets (
    article_id  TEXT NOT NULL,
    kind        TEXT NOT NULL,                 -- 'audio'
    path        TEXT,
    script_hash TEXT,                          -- audio is rebuilt when the script text changes
    duration_s  REAL,
    status      TEXT NOT NULL,                 -- ok | failed
    attempts    INTEGER NOT NULL DEFAULT 0,
    error       TEXT,
    updated_at  TEXT NOT NULL,
    PRIMARY KEY (article_id, kind)
);
"""


def make_script(item: dict, max_chars: int = 600) -> str:
    """Deterministic, extractive spoken script built from our own short summary (no LLM)."""
    def sentence(text):
        text = re.sub(r"\s+", " ", text or "").strip()
        return text if not text or text[-1] in ".!?" else text + "."
    parts = [sentence(item["category"]), sentence(item["headline"]),
             sentence(spoken_summary(item["headline"], item["summary"])),
             f"Source: {item['source']}."]
    script = " ".join(p for p in parts if p)
    return script if len(script) <= max_chars else script[: max_chars - 1].rsplit(" ", 1)[0] + "."


def script_hash(script: str) -> str:
    return hashlib.sha1(script.encode()).hexdigest()[:12]


def _run(cmd, **kw):
    try:
        return subprocess.run(cmd, capture_output=True, check=True, timeout=kw.pop("timeout", 120), **kw)
    except subprocess.CalledProcessError as e:  # surface the tool's own message, not just the command line
        raise RuntimeError(f"{Path(cmd[0]).name} exited {e.returncode}: "
                           f"{(e.stderr or b'').decode(errors='replace').strip()[-200:]}") from None


def pick_voice(rank, cfg) -> str:
    """The voice for the story at this place in the feed: the voices take turns, so neighbours never sound alike."""
    voices = cfg.tts_voices
    return voices[(rank or 0) % len(voices)] if voices else ""


def synthesize(script: str, out_mp3: Path, cfg, speed=None, voice: str = "") -> float:
    """TTS -> wav -> mp3 via a temp file, then atomic rename. Returns duration in seconds."""
    out_mp3.parent.mkdir(parents=True, exist_ok=True)
    wav, tmp = out_mp3.with_suffix(".wav.tmp"), out_mp3.with_suffix(".mp3.tmp")
    try:
        speed = cfg.tts_speed if speed is None else speed
        cmd = [a.replace("{wav}", str(wav)).replace("{speed}", str(speed)).replace("{voice}", voice) for a in cfg.tts_command]
        _run(cmd, input=script.encode(), timeout=cfg.tts_timeout_seconds)
        _run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-f", "mp3", "-b:a", "64k", str(tmp)])
        out = _run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                    "-of", "default=nw=1:nk=1", str(tmp)]).stdout
        os.replace(tmp, out_mp3)
        return round(float(out.strip()), 2)
    finally:
        wav.unlink(missing_ok=True)
        tmp.unlink(missing_ok=True)


def build_media(conn, cfg, feed: dict, out_dir, now_iso: str, synth=synthesize, fetch_images=True) -> dict:
    """Make audio for each prime item that lacks it. Safe to rerun; stops at the time budget.
    (Story videos are made by the explainer engine, pipeline/explainer/, from the funnel.)"""
    conn.executescript(ASSETS_SCHEMA)
    out_dir = Path(out_dir)
    stats = {"made": 0, "skipped": 0, "failed": 0, "deferred": 0}
    ranks = {i["id"]: n for n, i in enumerate(feed["prime"])}
    deadline = time.monotonic() + cfg.media_time_budget_seconds
    for item in sorted(feed["prime"], key=lambda i: i["published_at"], reverse=True):  # newest first
        script = item["script"]
        voice = pick_voice(ranks[item["id"]], cfg)
        key = script_hash(script + "|" + voice) if voice else script_hash(script)
        row = conn.execute("SELECT * FROM assets WHERE article_id=? AND kind='audio'", (item["id"],)).fetchone()
        path = out_dir / f"{item['id']}.mp3"
        if row and row["status"] == "ok" and row["script_hash"] == key and path.exists():
            stats["skipped"] += 1
            continue
        same_script = row and row["script_hash"] == key
        if row and row["status"] == "failed" and same_script and row["attempts"] >= cfg.media_max_attempts:
            stats["failed"] += 1
            continue
        if time.monotonic() >= deadline:
            stats["deferred"] += 1
            continue
        attempts = (row["attempts"] if same_script and row else 0) + 1
        try:
            duration = synth(script, path, cfg, voice=voice) if voice else synth(script, path, cfg)
            status, err = "ok", None
        except Exception as e:  # one bad story must not stop the rest
            duration, status, err = None, "failed", f"{type(e).__name__}: {e}"[:300]
            log.warning("audio failed for %s: %s", item["id"], err)
        with db.transaction(conn):
            conn.execute(
                "INSERT INTO assets(article_id,kind,path,script_hash,duration_s,status,attempts,error,updated_at)"
                " VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(article_id,kind) DO UPDATE SET path=excluded.path,"
                " script_hash=excluded.script_hash, duration_s=excluded.duration_s, status=excluded.status,"
                " attempts=excluded.attempts, error=excluded.error, updated_at=excluded.updated_at",
                (item["id"], "audio", path.name, key, duration, status, attempts, err, now_iso))
        stats["made" if status == "ok" else "failed"] += 1
    return stats


def attach_media(conn, cfg, feed: dict) -> None:
    """Add audio_url / duration_s to prime items that have finished audio."""
    conn.executescript(ASSETS_SCHEMA)
    base = cfg.audio_base_url.rstrip("/")
    for rank, item in enumerate(feed["prime"]):
        r = conn.execute("SELECT * FROM assets WHERE article_id=? AND kind='audio' AND status='ok'",
                         (item["id"],)).fetchone()
        voice = pick_voice(rank, cfg)
        ok = r and r["script_hash"] == (script_hash(item["script"] + "|" + voice) if voice else script_hash(item["script"]))
        item["audio_url"] = f"{base}/{r['path']}" if ok else None
        item["duration_s"] = r["duration_s"] if ok else None
