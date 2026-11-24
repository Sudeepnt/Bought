"""The explainer stage of the funnel: for the issue's top stories, plan -> check -> voice -> render -> gate.

Output per story, in out/issues/<date>/explainers/<story id>/:
  9x16.mp4  16x9.mp4  9x16.jpg  16x9.jpg  captions.vtt  plan.json
Publishing copies them to R2 at issues/<date>/explainers/<story id>/ (or into the site without R2), and the paper's
existing video spots play them: the 16:9 file where it played the wide video, the 9:16 file in the clips rail.

State per story is in the explainers table, which the desk reads: the plan, what the checks said, the theme, the
desk's theme override and approve / hold, missing portraits, render time. Stages are skipped when nothing that went
into them changed, and retried up to media_max_attempts when they fail."""
from __future__ import annotations

import hashlib
import json
import logging
import time
from datetime import datetime, timezone
from pathlib import Path

from . import library, plan as planner, render as renderer, themes, voice as voicer

log = logging.getLogger(__name__)
RENDER_VERSION = "1"        # bump when the library's look changes, so the issue's videos are made again
SCHEMA = """
CREATE TABLE IF NOT EXISTS explainers (
    issue          TEXT NOT NULL,
    article_id     TEXT NOT NULL,
    rank           INTEGER,
    headline       TEXT,
    section        TEXT,
    plan_key       TEXT,                 -- what went into the plan: when it changes, the story is planned again
    plan           TEXT,                 -- JSON
    plan_source    TEXT,                 -- ai | rules | rules-chosen (the desk asked for the rules' plan)
    checks         TEXT,                 -- JSON list: why the plan failed the checks; [] = passed
    status         TEXT,                 -- planned | needs_review | rendered | failed
    theme          TEXT,                 -- the theme it was rendered in
    theme_override TEXT,                 -- the desk's choice, wins over the automatic one
    decision       TEXT,                 -- NULL (goes out if it passed) | approve | hold
    missing        TEXT,                 -- JSON list of people named with no portrait yet
    portraits      TEXT,                 -- JSON list of portraits used
    duration_s     REAL,
    render_s       REAL,                 -- seconds the render took (both ratios)
    note           TEXT,
    error          TEXT,
    updated_at     TEXT NOT NULL,
    PRIMARY KEY (issue, article_id)
);
"""


def connect(conn):
    conn.executescript(SCHEMA)
    return conn


def _hash(*parts) -> str:
    return hashlib.sha1(json.dumps(parts, sort_keys=True, default=str).encode()).hexdigest()[:12]


def story_dir(base: Path, item_id: str) -> Path:
    return base / "explainers" / item_id


def _row(conn, date, item_id):
    return conn.execute("SELECT * FROM explainers WHERE issue=? AND article_id=?", (date, item_id)).fetchone()


def _save(conn, date, item_id, now_iso, **fields):
    if not _row(conn, date, item_id):
        conn.execute("INSERT INTO explainers (issue, article_id, updated_at) VALUES (?,?,?)", (date, item_id, now_iso))
    sets = ", ".join(f"{k}=?" for k in fields) + ", updated_at=?"
    conn.execute(f"UPDATE explainers SET {sets} WHERE issue=? AND article_id=?",
                 (*[json.dumps(v) if isinstance(v, (list, dict)) else v for v in fields.values()], now_iso, date, item_id))
    conn.commit()


def plans(conn, cfg, date, items, now_iso, client=None, sleep=time.sleep) -> dict:
    """Plan every story that has no current plan, in one batch; keep the rest. Returns {id: row as dict}."""
    cat = library.catalogue()
    cat_key = _hash([(o["id"], sorted(o["parts"])) for o in cat["objects"]], [(t["id"], sorted(t["fields"])) for t in cat["templates"]])
    todo = []
    for it in items:
        r = _row(conn, date, it["id"])
        key = _hash(planner.sources_for(it), planner.PROMPT_VERSION, cfg.explainer_model, cat_key, cfg.explainer_scenes, cfg.explainer_duration_s)
        if r and r["plan"] and (r["plan_key"] == key or r["plan_source"] == "rules-chosen"):
            continue
        todo.append((it, key))
    got = planner.plan_stories(conn, cfg, date, [it for it, _ in todo], now_iso, client=client, sleep=sleep) if todo else {}
    for it, key in todo:
        g = got[it["id"]]
        _save(conn, date, it["id"], now_iso, plan_key=key, plan=g["plan"], plan_source=g["source"], checks=g["checks"],
              status="planned" if g["status"] == "ok" else "needs_review", note=g.get("note"), error=None)
    return {it["id"]: dict(_row(conn, date, it["id"])) for it in items}


def build(conn, cfg, date: str, issue: dict, base: Path, stage, now_iso: str, limit=None, deadline=None, client=None, speak=None, render_fn=None,
          sleep=time.sleep, wait_quiet=None, only=None) -> tuple:
    """Make the explainers for the issue's top stories. stage is funnel.issue._stage (skip finished work, count attempts).
    Returns (built: {id: feed fields}, stats)."""
    connect(conn)
    speak = speak or voicer.kokoro
    render_fn = render_fn or renderer.render
    prime = issue["prime"]
    count = min(cfg.funnel_video_count, len(prime))
    items = [dict(it, _rank=n) for n, it in enumerate(prime[:count])]
    stats = {"passed": 0, "failed": 0, "deferred": 0, "not_attempted": 0, "needs_review": 0, "held": 0, "ai_plans": 0, "rules_plans": 0}
    if only is not None:                                   # the desk re-rendering one story: the rest is left as it is
        items = [it for it in items if it["id"] in only]
    if limit is not None:
        stats["not_attempted"] = max(0, len(items) - limit)
        items = items[:limit]
    for it in items:
        _save(conn, date, it["id"], now_iso, rank=it["_rank"], headline=it["headline"], section=themes.section(it))
    rows = plans(conn, cfg, date, items, now_iso, client=client, sleep=sleep)
    overrides = {i: r["theme_override"] for i, r in rows.items() if r.get("theme_override")}
    picked = themes.choose(items, date, overrides, known=library.theme_ids())
    bed = voicer.music_bed(Path(__file__).resolve().parents[1] / "data" / "explainer" / f"music-bed-{voicer.BED_VERSION}.wav")
    built = {}
    for it in items:
        r = rows[it["id"]]
        stats["ai_plans" if r["plan_source"] == "ai" else "rules_plans"] += 1
        if r["status"] == "needs_review" and r["decision"] != "approve":
            stats["needs_review"] += 1
            continue
        if r["decision"] == "hold":
            stats["held"] += 1
            continue
        if deadline and time.monotonic() >= deadline:
            stats["deferred"] += 1
            continue
        if wait_quiet:
            wait_quiet()
        plan, theme = json.loads(r["plan"]), picked[it["id"]]
        voice = cfg.funnel_voices[it["_rank"] % len(cfg.funnel_voices)]
        out = story_dir(base, it["id"])
        work = base / "work" / "explainers" / it["id"]
        story = {"section": themes.section(it), "n": it["_rank"] + 1, "total": len(issue.get("prime", [])) + len(issue.get("cards", [])),
                 "next": [prime[(it["_rank"] + k) % len(prime)]["headline"] for k in (1, 2, 3) if len(prime) > 1]}

        def do_voice():
            v = voicer.make_voice(plan, work, cfg, voice, speak=speak)
            voicer.mix(work / "voice.wav", bed, work / "mix.wav", v["duration"], cfg.explainer_music_db)
            return v
        voiced = stage(conn, cfg, date, it["id"], "voice", _hash(plan, voice, cfg.tts_speed, cfg.explainer_music_db, voicer.BED_VERSION), now_iso, do_voice)
        if not voiced or not (work / "mix.wav").exists():
            stats["failed"] += 1
            _save(conn, date, it["id"], now_iso, status="failed", error=_last_error(conn, date, it["id"], "voice"))
            continue

        def do_video():
            t0 = time.monotonic()
            got = render_fn(plan, theme, story, voiced, work / "mix.wav", out, work, cfg)
            (out / "captions.vtt").write_text(voicer.vtt(voiced["cues"]), encoding="utf-8")
            (out / "plan.json").write_text(json.dumps(plan, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
            return {**got, "render_s": round(time.monotonic() - t0, 1)}
        done = stage(conn, cfg, date, it["id"], "video", _hash(plan, theme, story, voiced["timing"], RENDER_VERSION, cfg.explainer_ratios, cfg.explainer_fps), now_iso, do_video)
        if not done or not all((out / f"{r_}.mp4").exists() for r_ in cfg.explainer_ratios):
            stats["failed"] += 1
            _save(conn, date, it["id"], now_iso, status="failed", error=_last_error(conn, date, it["id"], "video"))
            continue
        _save(conn, date, it["id"], now_iso, status="rendered", theme=theme, duration_s=voiced["duration"], render_s=done.get("render_s"),
              missing=done.get("missing", []), portraits=done.get("portraits", []), error=None)
        stats["passed"] += 1
        rel = f"explainers/{it['id']}"
        fields = {"duration_s": voiced["duration"], "voice": voice, "theme": theme, "script": " ".join(c["text"] for c in voiced["cues"]),
                  "captions_url": f"{rel}/captions.vtt", "plan_url": f"{rel}/plan.json", "explainer": True}
        if "16x9" in cfg.explainer_ratios:
            fields |= {"video_url": f"{rel}/16x9.mp4", "poster_url": f"{rel}/16x9.jpg", "image_url": f"{rel}/16x9.jpg"}
        if "9x16" in cfg.explainer_ratios:
            fields |= {"reel_url": f"{rel}/9x16.mp4", "reel_poster_url": f"{rel}/9x16.jpg"}
            if "16x9" not in cfg.explainer_ratios:
                fields |= {"video_url": f"{rel}/9x16.mp4", "poster_url": f"{rel}/9x16.jpg", "image_url": f"{rel}/9x16.jpg"}
        built[it["id"]] = fields
    return built, stats


def _last_error(conn, date, item_id, stage):
    r = conn.execute("SELECT error FROM story_media WHERE issue=? AND article_id=? AND stage=?", (date, item_id, stage)).fetchone()
    return r["error"] if r else None


def portraits_needed(conn, limit=200) -> list:
    """People named in planned stories who have no portrait yet, most often first: the desk's "Portraits needed" list."""
    connect(conn)
    counts = {}
    for r in conn.execute("SELECT issue, missing FROM explainers WHERE missing IS NOT NULL AND missing != '[]' ORDER BY issue DESC LIMIT 2000"):
        for name in json.loads(r["missing"]):
            c = counts.setdefault(name, {"name": name, "stories": 0, "last": r["issue"]})
            c["stories"] += 1
    names = {p["name"].lower() for p in library.catalogue().get("portraits", [])} | {a.lower() for p in library.catalogue().get("portraits", []) for a in p.get("aliases", [])}
    return sorted((c for c in counts.values() if c["name"].lower() not in names), key=lambda c: (-c["stories"], c["name"]))[:limit]


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
