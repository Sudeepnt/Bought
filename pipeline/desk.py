"""The editor's desk: what the admin page reads and changes. The rules choose first; a person has the last word.

  review     the rules' picks, plus everything else on brief. Each story can be ignored, used today or held for tomorrow.
  finalized  the list is fixed and shown for a last look
  building   Publish was clicked: videos and audio are being made from exactly that list
  ready      waiting for the publish time (Settings)
  live       on the site; emails go out

The editor's choices live in their own database (desk.db), so a new intake can never undo them.
"""
from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

from .funnel import publish as fp

PKG = Path(__file__).resolve().parent
ROOT = PKG.parent
ZONES = {"IST": "Asia/Kolkata", "UTC": "UTC"}
DEFAULTS = {"publish_time": "07:00", "publish_zone": "IST", "auto_fetch_minutes": "0", "site_url": os.environ.get("SITE_URL", ""), "mail_address": "", "target_stories": "50"}
STAGES = ("review", "finalized", "building", "ready", "live")

SCHEMA = """
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS decisions (article_id TEXT PRIMARY KEY, action TEXT NOT NULL, issue TEXT NOT NULL, at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS issues (
    date TEXT PRIMARY KEY, state TEXT NOT NULL, list TEXT, held INTEGER NOT NULL DEFAULT 0, go_now INTEGER NOT NULL DEFAULT 0, error TEXT, stats TEXT,
    finalized_at TEXT, publish_clicked_at TEXT, ready_at TEXT, live_at TEXT, emailed_at TEXT, languages TEXT);
CREATE TABLE IF NOT EXISTS jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, issue TEXT, status TEXT NOT NULL, started_at TEXT NOT NULL, ended_at TEXT, exit_code INTEGER, log TEXT);
CREATE TABLE IF NOT EXISTS runs (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, stats TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS subscribers (
    email TEXT PRIMARY KEY, status TEXT NOT NULL, token TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, confirm_sent_at TEXT, confirmed_at TEXT, unsubscribed_at TEXT);
CREATE TABLE IF NOT EXISTS email_log (issue TEXT NOT NULL, email TEXT NOT NULL, status TEXT NOT NULL, error TEXT, at TEXT NOT NULL, PRIMARY KEY (issue, email));
"""


def data_dir() -> Path:
    return Path(os.environ.get("BOUGHT_DATA") or PKG / "data")


def out_dir() -> Path:
    return Path(os.environ.get("BOUGHT_OUT") or PKG / "out")


def public_dir() -> Path:
    return Path(os.environ.get("BOUGHT_PUBLIC") or ROOT / "public")


def connect(path=None) -> sqlite3.Connection:
    path = Path(path or data_dir() / "desk.db")
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, timeout=30, isolation_level=None)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript(SCHEMA)
    return conn


def stamp(now: datetime) -> str:
    return now.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def get_settings(desk) -> dict:
    return {**DEFAULTS, **{r["key"]: r["value"] for r in desk.execute("SELECT key, value FROM settings")}}


def save_settings(desk, values: dict) -> dict:
    """Refuses a bad value instead of guessing; raises ValueError with what is wrong."""
    clean = {}
    if "publish_time" in values:
        datetime.strptime(values["publish_time"], "%H:%M")
        clean["publish_time"] = values["publish_time"]
    if "publish_zone" in values:
        if values["publish_zone"] not in ZONES:
            raise ValueError("unknown time zone")
        clean["publish_zone"] = values["publish_zone"]
    if "auto_fetch_minutes" in values:
        n = int(values["auto_fetch_minutes"])
        if n and n < 15:
            raise ValueError("fetch at most every 15 minutes, or 0 for off")
        clean["auto_fetch_minutes"] = str(n)
    if "target_stories" in values:
        clean["target_stories"] = str(max(1, int(values["target_stories"])))
    if "site_url" in values:
        url = values["site_url"].strip().rstrip("/")
        if url and not url.startswith(("https://", "http://")):
            raise ValueError("the site address must start with https://")
        clean["site_url"] = url
    if "mail_address" in values:
        clean["mail_address"] = values["mail_address"].strip()[:300]
    for k, v in clean.items():
        desk.execute("INSERT OR REPLACE INTO settings VALUES (?,?)", (k, v))
    return clean


def publish_label(settings: dict) -> str:
    return f"{settings['publish_time']} {settings['publish_zone']}"


def due_at(date: str, settings: dict) -> datetime:
    return datetime.strptime(f"{date} {settings['publish_time']}", "%Y-%m-%d %H:%M").replace(tzinfo=ZoneInfo(ZONES[settings["publish_zone"]]))


def add_days(date: str, n: int) -> str:
    return (datetime.strptime(date, "%Y-%m-%d") + timedelta(days=n)).strftime("%Y-%m-%d")


def issue_row(desk, date: str):
    return desk.execute("SELECT * FROM issues WHERE date=?", (date,)).fetchone()


def is_live_on_site(date: str) -> bool:
    return (public_dir() / "issues" / date / "issue.json").exists()


def stage(desk, date: str) -> str:
    row = issue_row(desk, date)
    if row:
        return row["state"]
    return "live" if is_live_on_site(date) else "review"


def working_date(desk, now: datetime) -> str:
    """The issue being worked on: the first date, from today on, that is not live yet."""
    settings = get_settings(desk)
    date = now.astimezone(ZoneInfo(ZONES[settings["publish_zone"]])).strftime("%Y-%m-%d")
    for _ in range(8):
        if stage(desk, date) != "live":
            return date
        date = add_days(date, 1)
    return date


# ---------- the review board ----------

def _story(r, **extra) -> dict:
    return {"id": r["id"], "title": fp.clean_headline(r["title"], r["source"]), "summary": fp.clean_summary(r["summary"], r["title"]), "source": r["source"],
            "section": fp.SECTIONS.get(r["category"], r["category"]), "link": r["canonical_url"], "published_at": r["published_at"], "score": r["score"], "picture": bool(r["image_url"]), **extra}


def board(news, desk, date: str) -> dict:
    """Four lists for one issue. The rules' picks stay chosen until the editor says otherwise."""
    rows = {r["id"]: r for r in news.execute("SELECT * FROM articles")}
    picks = [r["article_id"] for r in news.execute("SELECT article_id FROM selections WHERE slot IN ('prime','cards') ORDER BY CASE slot WHEN 'prime' THEN 0 ELSE 1 END, rank")]
    decisions = {r["article_id"]: r for r in desk.execute("SELECT * FROM decisions")}
    used = lambda i: i in rows and rows[i]["status"] == "used"
    held = {i: d["issue"] for i, d in decisions.items() if d["action"] == "use"}
    ignored = {i for i, d in decisions.items() if d["action"] == "ignore"}
    chosen = [i for i in picks if i in rows and not used(i) and i not in ignored and held.get(i, date) <= date]
    chosen += [i for i, d in held.items() if d == date and i not in chosen and i in rows and not used(i)]
    later = [i for i, d in held.items() if d > date and i in rows and not used(i)]
    taken = set(chosen) | set(later) | ignored
    left = [r for r in rows.values() if (r["status"] == "new" or r["status"].startswith("selected_")) and r["id"] not in taken]
    left.sort(key=lambda r: -(r["score"] or 0))
    gone = sorted((decisions[i] for i in ignored if decisions[i]["issue"] == date and i in rows), key=lambda d: d["at"], reverse=True)
    return {"chosen": [_story(rows[i], mine=i in held) for i in chosen], "left": [_story(r) for r in left], "tomorrow": [_story(rows[i], held_for=held[i]) for i in later],
            "ignored": [_story(rows[d["article_id"]]) for d in gone]}


def decide(news, desk, article_id: str, action: str, date: str, now: datetime) -> None:
    """today | tomorrow | ignore. Ignoring also takes the story out of the rules' pool, so the next intake cannot pick it again."""
    row = news.execute("SELECT status, reject_reason FROM articles WHERE id=?", (article_id,)).fetchone()
    if not row:
        raise KeyError(article_id)
    if action not in ("today", "tomorrow", "ignore"):
        raise ValueError(action)
    if stage(desk, date) != "review":
        raise PermissionError("this issue is already finalized")
    if action == "ignore":
        desk.execute("INSERT OR REPLACE INTO decisions VALUES (?,?,?,?)", (article_id, "ignore", date, stamp(now)))
        news.execute("UPDATE articles SET status='rejected', reject_reason='desk:ignored' WHERE id=?", (article_id,))
        return
    if row["reject_reason"] == "desk:ignored":
        news.execute("UPDATE articles SET status='new', reject_reason=NULL WHERE id=?", (article_id,))
    desk.execute("INSERT OR REPLACE INTO decisions VALUES (?,?,?,?)", (article_id, "use", date if action == "today" else add_days(date, 1), stamp(now)))


# ---------- the stages ----------

def set_issue(desk, date: str, **fields) -> None:
    if not issue_row(desk, date):
        desk.execute("INSERT INTO issues (date, state) VALUES (?, 'review')", (date,))
    if fields:
        desk.execute(f"UPDATE issues SET {', '.join(k + '=?' for k in fields)} WHERE date=?", (*fields.values(), date))


def finalize(news, desk, date: str, now: datetime) -> list:
    if stage(desk, date) != "review":
        raise PermissionError("this issue is already finalized")
    ids = [s["id"] for s in board(news, desk, date)["chosen"]]
    if not ids:
        raise ValueError("no stories chosen")
    set_issue(desk, date, state="finalized", list=json.dumps(ids), finalized_at=stamp(now), error=None)
    return ids


def final_list(desk, date: str) -> list:
    row = issue_row(desk, date)
    return json.loads(row["list"]) if row and row["list"] else []


def final_stories(news, desk, date: str) -> list:
    rows = {r["id"]: r for r in news.execute("SELECT * FROM articles")}
    return [_story(rows[i]) for i in final_list(desk, date) if i in rows]


def back_to_review(news, desk, date: str) -> None:
    """Reopen the list. Not once it is live, and not while its videos are being made."""
    if stage(desk, date) not in ("finalized", "ready", "failed"):
        raise PermissionError("this issue cannot be reopened now")
    ids = final_list(desk, date)
    news.executemany("UPDATE articles SET status='new', reject_reason=NULL WHERE id=? AND status='used'", [(i,) for i in ids])
    set_issue(desk, date, state="review", list=None, held=0, go_now=0, error=None)


def click_publish(news, desk, date: str, now: datetime) -> list:
    """Publish clicked: these stories are spoken for, so tomorrow's rules cannot run them again. The caller starts the build."""
    if stage(desk, date) not in ("finalized", "failed"):
        raise PermissionError("finalize the list first")
    ids = final_list(desk, date)
    news.executemany("UPDATE articles SET status='used', reject_reason=? WHERE id=?", [(f"issue:{date}", i) for i in ids])
    set_issue(desk, date, state="building", publish_clicked_at=stamp(now), error=None)
    return ids


# ---------- what the dashboard shows ----------

def record_run(desk, stats: dict, now: datetime) -> None:
    desk.execute("INSERT INTO runs (at, stats) VALUES (?,?)", (stamp(now), json.dumps(stats)))


def overview(news, desk, date: str, now: datetime, source_names=()) -> dict:
    count = lambda q, *a: news.execute(q, a).fetchone()[0]
    midnight = now.astimezone(ZoneInfo("Asia/Kolkata")).replace(hour=0, minute=0, second=0, microsecond=0)
    since = stamp(midnight)
    b = board(news, desk, date)
    run = desk.execute("SELECT * FROM runs ORDER BY id DESC LIMIT 1").fetchone()
    last = json.loads(run["stats"]) if run else {}
    state = {r["source"]: r for r in news.execute("SELECT * FROM fetch_state")}
    per = {r["source"]: r for r in news.execute("SELECT source, COUNT(*) total, SUM(fetched_at>=?) today FROM articles GROUP BY source", (since,))}
    sources = []
    for name in list(source_names) + [n for n in per if n not in source_names]:
        p, st = per.get(name), state.get(name)
        lr = last.get(name) or {}
        sources.append({"name": name, "total": p["total"] if p else 0, "today": (p["today"] or 0) if p else 0, "last_seen": lr.get("seen"), "last_new": lr.get("new"),
                        "last_ok": st["last_ok_at"] if st else None, "error": (lr.get("error") or (st["last_error"] if st else None))})
    subs = {r["status"]: r["n"] for r in desk.execute("SELECT status, COUNT(*) n FROM subscribers GROUP BY status")}
    return {
        "scraped_today": count("SELECT COUNT(*) FROM articles WHERE fetched_at>=?", since), "scraped_total": count("SELECT COUNT(*) FROM articles"),
        "duplicates": count("SELECT COUNT(*) FROM articles WHERE reject_reason LIKE 'duplicate_of%'"), "off_brief": count("SELECT COUNT(*) FROM articles WHERE reject_reason LIKE 'rules:%'"),
        "too_old": count("SELECT COUNT(*) FROM articles WHERE status='expired'"), "used": count("SELECT COUNT(*) FROM articles WHERE status='used'"),
        "chosen": len(b["chosen"]), "left": len(b["left"]), "tomorrow": len(b["tomorrow"]), "ignored": len(b["ignored"]), "on_brief": len(b["chosen"]) + len(b["left"]),
        "finalized": len(final_list(desk, date)), "sources": sources, "last_run_at": run["at"] if run else None, "subscribers": subs,
    }
