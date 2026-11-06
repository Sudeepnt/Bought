"""Reader counts for the desk's dashboard, kept on this server (stats.db), never sent anywhere.

No cookie, no stored id, no IP address. A visitor is counted once a day by a hash of (that day's random salt, IP, browser);
the salt is deleted the day after, so a hash can't be linked to a person or to the same reader on another day. The page
remembers only the date of its first visit (localStorage, never sent as an id), which says whether a visit is a new reader.

Hits are queued in memory and written every few seconds in one transaction, so a crowd at 06:00 UTC costs the server
almost nothing. Only daily totals are kept long term; the per-visitor rows that make "unique" possible are dropped after
two days.
"""
from __future__ import annotations

import hashlib
import re
import secrets
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")
KINDS = {"visit", "view", "read", "time", "listen", "share", "source"}
VIEWS = {"paper", "radio", "advertise", "spec"}
BOT = re.compile(r"bot|crawl|spider|slurp|preview|headless|lighthouse|monitor|curl|wget|python|httpclient|java/|go-http|facebookexternalhit|embedly|whatsapp|telegram", re.I)
STORY = re.compile(r"[0-9a-f]{6,40}")
DATE = re.compile(r"\d{4}-\d{2}-\d{2}")
LANG = re.compile(r"[a-z]{2,3}(-[A-Za-z]{2,4})?")
ZONE = re.compile(r"[A-Za-z_]+(/[A-Za-z0-9_+-]+){0,2}")
HOST = re.compile(r"[a-z0-9.-]{1,80}")
QUEUE_MAX = 50_000                      # if the writer ever falls behind, drop hits rather than memory

SCHEMA = """
CREATE TABLE IF NOT EXISTS salts (day TEXT PRIMARY KEY, salt TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS seen (day TEXT NOT NULL, visitor TEXT NOT NULL, what TEXT NOT NULL, PRIMARY KEY (day, visitor, what)) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS daily (day TEXT PRIMARY KEY, visitors INTEGER NOT NULL DEFAULT 0, new_visitors INTEGER NOT NULL DEFAULT 0,
    visits INTEGER NOT NULL DEFAULT 0, reads INTEGER NOT NULL DEFAULT 0, readers INTEGER NOT NULL DEFAULT 0, read_secs REAL NOT NULL DEFAULT 0,
    listens INTEGER NOT NULL DEFAULT 0, shares INTEGER NOT NULL DEFAULT 0, sources INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS hours (day TEXT NOT NULL, hour INTEGER NOT NULL, visitors INTEGER NOT NULL DEFAULT 0, visits INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, hour));
CREATE TABLE IF NOT EXISTS dims (day TEXT NOT NULL, dim TEXT NOT NULL, value TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, dim, value));
CREATE TABLE IF NOT EXISTS stories (issue TEXT NOT NULL, story TEXT NOT NULL, day TEXT NOT NULL, reads INTEGER NOT NULL DEFAULT 0, readers INTEGER NOT NULL DEFAULT 0,
    secs REAL NOT NULL DEFAULT 0, timed INTEGER NOT NULL DEFAULT 0, shares INTEGER NOT NULL DEFAULT 0, sources INTEGER NOT NULL DEFAULT 0, listens INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (issue, story, day));
CREATE INDEX IF NOT EXISTS stories_day ON stories(day);
"""


def device(ua: str) -> str:
    if re.search(r"iPad|Tablet|Android(?!.*Mobile)", ua):
        return "Tablet"
    if re.search(r"Mobi|iPhone|Android", ua):
        return "Phone"
    return "Computer"


def referrer(value: str, own_host: str) -> str:
    """Where the reader came from, as a bare site name. Nothing after the host is kept."""
    host = (urlparse(value).hostname or "").lower().removeprefix("www.") if value else ""
    if not host or host == own_host.removeprefix("www.") or not HOST.fullmatch(host):
        return "Direct"
    for name, marks in (("Google", ("google.",)), ("Bing", ("bing.com",)), ("DuckDuckGo", ("duckduckgo.com",)), ("X", ("t.co", "x.com", "twitter.com")),
                        ("LinkedIn", ("linkedin.com", "lnkd.in")), ("Facebook", ("facebook.com", "fb.com")), ("Reddit", ("reddit.com",)),
                        ("Hacker News", ("news.ycombinator.com",)), ("WhatsApp", ("whatsapp.com", "wa.me")), ("Instagram", ("instagram.com",)),
                        ("Email", ("mail.google.com", "outlook.live.com", "mail.yahoo.com"))):
        if any(host == m or host.endswith("." + m) or host.startswith(m) for m in marks):
            return name
    return host


def clean(hit: dict) -> dict | None:
    """Only known fields, in known shapes. Anything else is dropped, so the page can't be used to write text into the desk."""
    kind = hit.get("k")
    if kind not in KINDS:
        return None
    out = {"k": kind}
    issue = str(hit.get("i") or "")
    out["i"] = issue if DATE.fullmatch(issue) else ""
    story = str(hit.get("s") or "")
    if kind in ("read", "time", "share", "source"):
        if not STORY.fullmatch(story) or not out["i"]:
            return None
        out["s"] = story
    view = str(hit.get("v") or "")
    out["v"] = view if view in VIEWS else ""
    if kind == "view" and not out["v"]:
        return None
    if kind == "time":
        try:
            secs = float(hit.get("d"))
        except (TypeError, ValueError):
            return None
        if not 1 <= secs <= 3600:
            return None
        out["d"] = min(secs, 1800.0)           # a tab left open is not 3 hours of reading
    lang = str(hit.get("l") or "")
    out["l"] = lang if LANG.fullmatch(lang) else ""
    zone = str(hit.get("z") or "")
    out["z"] = zone if len(zone) <= 40 and ZONE.fullmatch(zone) else ""
    out["n"] = hit.get("n") is True
    out["r"] = str(hit.get("r") or "")[:300]
    return out


class Collector:
    def __init__(self, path: Path, own_host: str = ""):
        self.path, self.own_host = Path(path), own_host
        self.queue, self.lock, self.write_lock = [], threading.Lock(), threading.Lock()
        self.dropped = 0

    def connect(self) -> sqlite3.Connection:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(self.path, timeout=30, isolation_level=None)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.executescript(SCHEMA)
        return conn

    def add(self, hit: dict, ip: str, ua: str, now: datetime) -> bool:
        """Cheap: checks the hit and queues it. Returns False when it isn't counted (a bot, or a bad hit)."""
        if not ua or BOT.search(ua):
            return False
        hit = clean(hit)
        if not hit:
            return False
        hit["ip"], hit["ua"], hit["at"] = ip, ua[:400], now
        with self.lock:
            if len(self.queue) >= QUEUE_MAX:
                self.dropped += 1
                return False
            self.queue.append(hit)
        return True

    def flush(self) -> int:
        with self.lock:
            batch, self.queue = self.queue, []
        if not batch:
            return 0
        with self.write_lock:
            conn = self.connect()
            try:
                conn.execute("BEGIN IMMEDIATE")
                salts = {}
                for hit in batch:
                    self._write(conn, hit, salts)
                self._forget(conn, batch[-1]["at"])
                conn.execute("COMMIT")
            except BaseException:
                conn.execute("ROLLBACK")
                raise
            finally:
                conn.close()
        return len(batch)

    def _salt(self, conn, day: str, salts: dict) -> str:
        if day not in salts:
            conn.execute("INSERT OR IGNORE INTO salts VALUES (?,?)", (day, secrets.token_hex(16)))
            salts[day] = conn.execute("SELECT salt FROM salts WHERE day=?", (day,)).fetchone()[0]
        return salts[day]

    def _write(self, conn, hit: dict, salts: dict) -> None:
        local = hit["at"].astimezone(IST)
        day, hour = local.strftime("%Y-%m-%d"), local.hour
        visitor = hashlib.sha256(f"{self._salt(conn, day, salts)}|{hit['ip']}|{hit['ua']}".encode()).hexdigest()[:24]
        first = lambda what: conn.execute("INSERT OR IGNORE INTO seen VALUES (?,?,?)", (day, visitor, what)).rowcount == 1
        bump = lambda **cols: conn.execute(
            f"INSERT INTO daily (day, {', '.join(cols)}) VALUES (?, {', '.join('?' * len(cols))}) ON CONFLICT(day) DO UPDATE SET "
            + ", ".join(f"{k}={k}+excluded.{k}" for k in cols), (day, *cols.values()))
        story = lambda **cols: conn.execute(
            f"INSERT INTO stories (issue, story, day, {', '.join(cols)}) VALUES (?,?,?, {', '.join('?' * len(cols))}) ON CONFLICT(issue, story, day) DO UPDATE SET "
            + ", ".join(f"{k}={k}+excluded.{k}" for k in cols), (hit["i"], hit["s"], day, *cols.values()))
        dim = lambda name, value: value and conn.execute(
            "INSERT INTO dims VALUES (?,?,?,1) ON CONFLICT(day, dim, value) DO UPDATE SET n=n+1", (day, name, value))
        kind = hit["k"]
        if kind == "visit":
            new_today = first("v")
            bump(visits=1, visitors=int(new_today), new_visitors=int(new_today and hit["n"]))
            conn.execute("INSERT INTO hours VALUES (?,?,?,1) ON CONFLICT(day, hour) DO UPDATE SET visitors=visitors+excluded.visitors, visits=visits+1",
                         (day, hour, int(new_today)))
            dim("issue", hit["i"])
            if new_today:
                dim("device", device(hit["ua"]))
                dim("from", referrer(hit["r"], self.own_host))
                dim("lang", hit["l"] or "en")
                dim("zone", hit["z"])
                dim("first view", hit["v"] or "paper")
        elif kind == "view":
            if first("view:" + hit["v"]):
                dim("view", hit["v"])
        elif kind == "read":
            new_reader = first(f"r:{hit['i']}:{hit['s']}")
            new_daily_reader = first("reader")
            bump(reads=1, readers=int(new_daily_reader))
            story(reads=1, readers=int(new_reader))
        elif kind == "time":
            bump(read_secs=hit["d"])
            story(secs=hit["d"], timed=1)
        elif kind == "listen":
            if first("listen:" + hit["i"]):
                bump(listens=1)
                dim("listen", hit["i"])
        elif kind == "share":
            bump(shares=1)
            story(shares=1)
        elif kind == "source":
            bump(sources=1)
            story(sources=1)

    def _forget(self, conn, now: datetime) -> None:
        """Yesterday's visitors stay countable for late hits around midnight; anything older is deleted for good."""
        keep = (now.astimezone(IST).date().toordinal() - 1)
        cutoff = datetime.fromordinal(keep).strftime("%Y-%m-%d")
        conn.execute("DELETE FROM seen WHERE day < ?", (cutoff,))
        conn.execute("DELETE FROM salts WHERE day < ?", (cutoff,))

    def run(self, stop: threading.Event, every: float = 5.0) -> None:
        while not stop.wait(every):
            try:
                self.flush()
            except Exception as exc:                # never take the site down over a count
                print(f"stats: {exc}", flush=True)
        self.flush()


def now_utc() -> datetime:
    return datetime.now(timezone.utc)
