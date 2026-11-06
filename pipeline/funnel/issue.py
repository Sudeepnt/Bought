"""The funnel itself. Intake runs as often as you like; an issue is cut (frozen) once, then built until every video is done.

  brief    brief.yaml says what news we want; sources.live.yaml lists where it comes from
  intake   visit the sources (titles and links) -> in the date window -> unique -> on brief -> jev decides -> ~50 selected -> descriptions fetched
  cut      the selection is written to out/issues/<date>/issue.json and never changes: videos carry their rank, "up next" and
           ticker in the picture, so re-ranking after this would make them wrong
  build    for each video story: images -> voice -> render -> gate. Safe to stop and rerun; finished stages are skipped
  feed     out/issues/<date>/feed.json, where only stories that passed the gate have a video; rights_review.json lists uncleared pictures
"""
from __future__ import annotations

import dataclasses
import hashlib
import json
import logging
import os
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

from .. import db
from ..dedupe import dedupe
from ..ingest import LiveFetcher, ingest_all, iso
from ..media import synthesize
from ..output import build_feed, story_item, write_feed
from ..scoring import prefilter, select
from ..text import short_summary
from .contracts import ImageAsset
from .brief import load_brief
from .evaluate import build_model, consider
from .images import Sourcer

log = logging.getLogger(__name__)
PKG = Path(__file__).resolve().parents[1]
ROOT = PKG.parent
THEMES = 20

SCHEMA = """
CREATE TABLE IF NOT EXISTS story_media (
    issue      TEXT NOT NULL,
    article_id TEXT NOT NULL,
    stage      TEXT NOT NULL,                 -- images | voice | video
    input_hash TEXT NOT NULL,                 -- a stage reruns only when what went into it changed
    status     TEXT NOT NULL,                 -- ok | failed
    attempts   INTEGER NOT NULL,
    result     TEXT,                          -- JSON
    error      TEXT,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (issue, article_id, stage)
);
"""


def issue_date(now=None) -> str:
    return (now or datetime.now(timezone.utc)).astimezone(ZoneInfo("Asia/Kolkata")).strftime("%Y-%m-%d")


def issue_dir(date: str, out_root=None) -> Path:
    return Path(out_root or os.environ.get("BOUGHT_OUT") or PKG / "out") / "issues" / date


def intake(conn, cfg, sources, now, fetcher=None, brief=None, past=False) -> dict:
    """Everything before the freeze. A story needs no picture here: pictures are sourced later, and only with a right to use them."""
    brief = brief or load_brief()
    cfg = dataclasses.replace(cfg, og_fallback=False, max_age_hours=brief.window_hours, ingest_reject_future=past)
    fetcher = fetcher or LiveFetcher(cfg)
    try:
        stats = ingest_all(conn, sources, fetcher, cfg, now)
        prefilter(conn, cfg, now, require_image=False)
        dupes = dedupe(conn, cfg)
        relevance = consider(conn, cfg, iso(now), brief, {s.name for s in sources if s.always_on_brief}, build_model(cfg, brief))
        selection = select(conn, cfg, now, relevance=relevance, sections=brief.sections)
        described = describe_selected(conn, fetcher)
    finally:
        fetcher.close()
    return {"ingest": stats, "duplicates_rejected": dupes, "selection": selection, "described": described}


def describe_selected(conn, fetcher, ids=None) -> int:
    """For the stories that made it, open the article page once: its share picture (usually the largest) and, if we have none, its summary.
    ids: these stories instead of the rules' selection (the list an editor finalized)."""
    conn.execute("CREATE TABLE IF NOT EXISTS described (article_id TEXT PRIMARY KEY)")
    done = 0
    if ids is None:
        rows = conn.execute("SELECT DISTINCT a.id, a.canonical_url, a.summary FROM selections s JOIN articles a ON a.id=s.article_id"
                            " WHERE a.id NOT IN (SELECT article_id FROM described)").fetchall()
    else:
        known = {r[0] for r in conn.execute("SELECT article_id FROM described")}
        rows = [r for i in ids if i not in known for r in conn.execute("SELECT id, canonical_url, summary FROM articles WHERE id=?", (i,))]
    for r in rows:
        text, image = fetcher.page_meta(r["canonical_url"])
        with db.transaction(conn):
            if text and not r["summary"]:
                conn.execute("UPDATE articles SET summary=? WHERE id=?", (short_summary(text), r["id"]))
            if image:
                conn.execute("UPDATE articles SET image_url=? WHERE id=?", (image, r["id"]))
            conn.execute("INSERT OR IGNORE INTO described VALUES (?)", (r["id"],))
        done += bool(text or image)
    return done


def cut_issue(conn, cfg, date, now, sources, out_root=None, recut=False) -> dict:
    """Freeze the current selection as this date's issue. Cutting again returns the same issue unless recut=True."""
    path = issue_dir(date, out_root) / "issue.json"
    if path.exists() and not recut:
        return json.loads(path.read_text())
    issue = build_feed(conn, cfg, iso(now))
    refused = {s.name for s in sources if s.image_rights == "link_only"}
    for slot in db.SLOTS:
        for item in issue[slot]:
            if not cfg.funnel_publisher_images or item["source"] in refused:
                item["image_url"], item["image_credit"] = None, None
    issue["issue"] = date
    write_feed(issue, path)
    return issue


def cut_list(conn, cfg, date, ids, now, sources, out_root=None) -> dict:
    """Freeze exactly the list the editor finalized, in its order. Replaces any earlier cut of this date, and any audio or languages made from it."""
    refused = {s.name for s in sources if s.image_rights == "link_only"}
    rows = {r["id"]: r for r in conn.execute("SELECT * FROM articles")}
    items = [dict(story_item(rows[i], cfg, n < cfg.slots["prime"])) for n, i in enumerate(ids) if i in rows]
    for item in items:
        if not cfg.funnel_publisher_images or item["source"] in refused:
            item["image_url"], item["image_credit"] = None, None
    prime = cfg.slots["prime"]
    issue = {"generated_at": iso(now), "slots": dict(cfg.slots), "prime": items[:prime], "cards": items[prime:], "glance": items[:cfg.slots["glance"]], "issue": date}
    base = issue_dir(date, out_root)
    for stale in (base / "media" / "podcast.mp3", base / "media" / "podcast.json", base / "feed.json"):
        stale.unlink(missing_ok=True)
    if (base / "translations").exists():
        for f in (base / "translations").glob("*.json"):
            f.unlink()
    write_feed(issue, base / "issue.json")
    return issue


def _hash(*parts) -> str:
    return hashlib.sha1(json.dumps(parts, sort_keys=True).encode()).hexdigest()[:12]


def _stage(conn, cfg, date, item_id, name, key, now_iso, work):
    """Run one stage unless it is already done for these inputs. Returns its result, or None if it failed or gave up."""
    r = conn.execute("SELECT * FROM story_media WHERE issue=? AND article_id=? AND stage=?", (date, item_id, name)).fetchone()
    same = r and r["input_hash"] == key
    if same and r["status"] == "ok":
        return json.loads(r["result"])
    if same and r["attempts"] >= cfg.media_max_attempts:
        return None
    try:
        result, status, err = work(), "ok", None
    except Exception as e:                                   # one bad story must not stop the rest
        result, status, err = None, "failed", f"{type(e).__name__}: {e}"[:300]
        log.warning("%s failed for %s: %s", name, item_id, err)
    with db.transaction(conn):
        conn.execute("INSERT OR REPLACE INTO story_media VALUES (?,?,?,?,?,?,?,?,?)",
                     (date, item_id, name, key, status, (r["attempts"] if same else 0) + 1, json.dumps(result) if status == "ok" else None, err, now_iso))
    return result if status == "ok" else None


def make_voice(item, voice, wav, cfg, synth=synthesize) -> float:
    """Speak the script (rules wrote it; the voice engine only reads it aloud), with a short breath at each end."""
    mp3 = wav.with_suffix(".voice.mp3")
    synth(item["script"], mp3, cfg, voice=voice)
    tmp = wav.with_suffix(".tmp.wav")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(mp3), "-af", "adelay=500:all=1,apad=pad_dur=0.7", "-ac", "1", "-ar", "24000", str(tmp)], check=True, timeout=120)
    os.replace(tmp, wav)
    mp3.unlink(missing_ok=True)
    return round(float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(wav)],
                                      capture_output=True, check=True, timeout=60).stdout), 2)


def render(spec_path) -> None:
    subprocess.run(["node", str(PKG / "prime_render.cjs"), str(spec_path)], check=True, timeout=1800)


def gate(mp4, poster, duration, assets, cfg) -> None:
    """The last check before a video can go out. Raises with the reason; a failed video is left out of the feed."""
    from PIL import Image, ImageStat
    from .images import license_ok
    for a in assets:
        if a.provider == "commons" and not license_ok(a.license, a.license, cfg.funnel_image_licenses):
            raise ValueError(f"licence not allowed: {a.license}")
        if a.provider == "commons" and not a.page_url:
            raise ValueError("picture has no source page to credit")
    if not assets:
        raise ValueError("no pictures")
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,width,height:format=duration", "-of", "json", str(mp4)],
                         capture_output=True, check=True, timeout=60).stdout
    info = json.loads(out)
    kinds = {s["codec_type"] for s in info["streams"]}
    if not {"video", "audio"} <= kinds:
        raise ValueError(f"streams are {sorted(kinds)}")
    size = next((s["width"], s["height"]) for s in info["streams"] if s["codec_type"] == "video")
    if size != (1280, 720):
        raise ValueError(f"size is {size}")
    if abs(float(info["format"]["duration"]) - duration) > 1.0:
        raise ValueError(f"video runs {info['format']['duration']}s, voice {duration}s")
    with Image.open(poster) as im:
        stat = ImageStat.Stat(im.convert("L"))
    if stat.mean[0] < 12 or stat.stddev[0] < 8:
        raise ValueError("still frame is blank")


def build_issue(conn, cfg, date, issue, out_root=None, sourcer=None, synth=synthesize, renderer=render, limit=None, clock="06:30 IST") -> dict:
    """Images -> voice -> video -> gate for the top stories, then write the feed. Returns counts per outcome."""
    conn.executescript(SCHEMA)
    base = issue_dir(date, out_root)
    media = base / "media"
    work = base / "work"
    media.mkdir(parents=True, exist_ok=True)
    work.mkdir(parents=True, exist_ok=True)
    now_iso = iso(datetime.now(timezone.utc))
    sourcer = sourcer or Sourcer(cfg, PKG / "data" / "images", now_year=int(date[:4]))
    prime = issue["prime"]
    count = min(cfg.funnel_video_count, len(prime))
    deadline = time.monotonic() + cfg.funnel_time_budget_seconds
    stats = {"passed": 0, "failed": 0, "deferred": 0, "not_attempted": 0, "commons": 0, "publisher": 0, "library": 0}
    built = {}
    for rank, item in enumerate(prime[:count]):
        if limit is not None and rank >= limit:
            stats["not_attempted"] += 1
            continue
        if time.monotonic() >= deadline:
            stats["deferred"] += 1
            continue
        got = _stage(conn, cfg, date, item["id"], "images", _hash(item["headline"], cfg.funnel_image_licenses, cfg.funnel_images_per_story, IMAGE_RULES), now_iso,
                     lambda: [a.to_json() for a in sourcer.for_story(item, use_publisher=cfg.funnel_publisher_images)])
        if not got:
            stats["failed"] += 1
            continue
        assets = [ImageAsset(**{k: v for k, v in a.items() if k != "credit"}) for a in got]
        for a in assets:
            stats[a.provider] += 1
        voice = cfg.funnel_voices[rank % len(cfg.funnel_voices)]
        wav = work / f"{item['id']}.wav"
        spoke = _stage(conn, cfg, date, item["id"], "voice", _hash(item["script"], voice), now_iso,
                       lambda: {"duration_s": make_voice(item, voice, wav, cfg, synth), "voice": voice})
        if not spoke or not wav.exists():
            stats["failed"] += 1
            continue
        duration = spoke["duration_s"]
        mp4, poster = media / f"{item['id']}.mp4", media / f"{item['id']}.jpg"
        shown = [a for a in assets] if len(assets) > 1 else assets * 2      # the frame cross-fades between pictures, so it needs two
        spec = {"theme": rank % THEMES + 1, "cat": item["category"], "n": rank + 1, "src": item["source"], "h": item["headline"].rstrip("."), "s": item["summary"],
                "next": [prime[(rank + k) % len(prime)]["headline"] for k in (1, 2, 3)], "images": [a.path for a in shown], "credits": [a.credit for a in shown],
                "positions": ["50% 18%" if a.height > a.width else "50% 50%" for a in shown], "frames": [a.frames for a in shown],
                "shot": max(2.6, min(6.0, duration / max(1, len(shown)))), "wav": str(wav), "dur": duration, "out": str(mp4), "poster": str(poster), "clock": clock}

        def do_video():
            spec_path = work / f"{item['id']}.json"
            spec_path.write_text(json.dumps(spec))
            renderer(spec_path)
            gate(mp4, poster, duration, assets, cfg)
            return {"bytes": mp4.stat().st_size}
        done = _stage(conn, cfg, date, item["id"], "video", _hash(spec, RENDER_VERSION), now_iso, do_video)
        if not done or not mp4.exists():
            stats["failed"] += 1
            continue
        stats["passed"] += 1
        built[item["id"]] = {"video_url": f"media/{mp4.name}", "poster_url": f"media/{poster.name}", "image_url": f"media/{poster.name}", "duration_s": duration, "voice": voice,
                             "images": [a.to_json() for a in assets], "image_source": assets[0].provider}
    feed = json.loads(json.dumps(issue))
    for slot in db.SLOTS:
        for item in feed[slot]:
            item.update(built.get(item["id"], {}))
    write_feed(feed, base / "feed.json")
    review = [{"article_id": i, "video": b["video_url"], "picture": a["url"], "article": a["page_url"], "credit": a["credit"]}
              for i, b in built.items() for a in b["images"] if a["provider"] == "publisher"]
    write_feed({"note": "Publisher pictures used without a licence yet.", "pictures": review}, base / "rights_review.json")
    return stats


RENDER_VERSION = "2"    # bump when prime_render.cjs changes the look
IMAGE_RULES = "4"       # bump when images.py picks differently, so the current issue's pictures are chosen again


def status(conn, date, out_root=None) -> list:
    """Where the stories went, top to bottom. Each line is a real count from the database."""
    lines = []
    count = lambda q, *a: conn.execute(q, a).fetchone()[0]
    lines.append(("stored articles", count("SELECT COUNT(*) FROM articles")))
    for r in conn.execute("SELECT reject_reason r, COUNT(*) n FROM articles WHERE status='rejected' GROUP BY r ORDER BY n DESC"):
        lines.append((f"  rejected: {r['r']}", r["n"]))
    lines.append(("  expired (too old)", count("SELECT COUNT(*) FROM articles WHERE status='expired'")))
    lines.append(("selected for the issue", count("SELECT COUNT(DISTINCT article_id) FROM selections")))
    has = conn.execute("SELECT 1 FROM sqlite_master WHERE name='story_media'").fetchone()
    if has:
        for stage in ("images", "voice", "video"):
            ok = count("SELECT COUNT(*) FROM story_media WHERE issue=? AND stage=? AND status='ok'", date, stage)
            bad = count("SELECT COUNT(*) FROM story_media WHERE issue=? AND stage=? AND status='failed'", date, stage)
            lines.append((f"{stage} done" + (" and passed the gate" if stage == "video" else ""), ok))
            if bad:
                lines.append((f"  {stage} failed", bad))
    return lines
