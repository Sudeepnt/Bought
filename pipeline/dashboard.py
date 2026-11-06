"""What the desk's Dashboard and News pages show: readers, the news from source to reader, issues, email, ads and the
server, read from the databases this server keeps (news.db, desk.db, stats.db) and the ads backend.

Days are IST days, like everywhere else on the desk.
"""
from __future__ import annotations

import json
import os
import shutil
import time
from datetime import date as Date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from . import desk as dk
from .funnel import publish as fp

IST = ZoneInfo("Asia/Kolkata")
RANGES = (7, 30, 90)
STARTED = time.time()


def ist_day(now: datetime) -> str:
    return now.astimezone(IST).strftime("%Y-%m-%d")


def day_list(today: str, days: int) -> list[str]:
    end = Date.fromisoformat(today)
    return [(end - timedelta(days=i)).isoformat() for i in range(days - 1, -1, -1)]


def utc_bounds(day: str) -> tuple[str, str]:
    """An IST day as the UTC stamps the databases store."""
    start = datetime.fromisoformat(day).replace(tzinfo=IST)
    return dk.stamp(start), dk.stamp(start + timedelta(days=1))


def ist_day_of(stamp: str) -> str:
    try:
        return datetime.strptime(stamp, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=ZoneInfo("UTC")).astimezone(IST).strftime("%Y-%m-%d")
    except (TypeError, ValueError):
        return ""


def change(now_value: float, before: float):
    """Percent change, or None when there is nothing to compare with."""
    return None if not before else round((now_value - before) / before * 100)


# ---------- readers ----------

def readers(stats, today: str, days: int) -> dict:
    span = day_list(today, days * 2)
    prev_days, cur_days = span[:days], span[days:]
    rows = {r["day"]: dict(r) for r in stats.execute("SELECT * FROM daily WHERE day >= ?", (span[0],))}
    blank = {"visitors": 0, "new_visitors": 0, "visits": 0, "reads": 0, "readers": 0, "read_secs": 0.0, "listens": 0, "shares": 0, "sources": 0}
    series = [{"day": d, **blank, **rows.get(d, {})} for d in cur_days]
    total = lambda key, ds: sum(rows.get(d, {}).get(key, 0) for d in ds)
    yesterday = day_list(today, 2)[0]
    all_time = stats.execute("SELECT COALESCE(SUM(new_visitors),0) people, COALESCE(SUM(visits),0) visits, COALESCE(SUM(reads),0) reads, MIN(day) since FROM daily").fetchone()
    hours = [0] * 24
    for r in stats.execute("SELECT hour, SUM(visits) n FROM hours WHERE day >= ? GROUP BY hour", (cur_days[0],)):
        hours[r["hour"]] = r["n"]
    dims = {}
    for r in stats.execute("SELECT dim, value, SUM(n) n FROM dims WHERE day >= ? GROUP BY dim, value ORDER BY n DESC", (cur_days[0],)):
        dims.setdefault(r["dim"], []).append((r["value"], r["n"]))
    read_secs, reads = total("read_secs", cur_days), total("reads", cur_days)
    timed = stats.execute("SELECT COALESCE(SUM(timed),0) FROM stories WHERE day >= ?", (cur_days[0],)).fetchone()[0]
    return {
        "series": series, "hours": hours, "dims": dims,
        "today": rows.get(today, {}).get("visitors", 0), "yesterday": rows.get(yesterday, {}).get("visitors", 0),
        "avg": round(total("visitors", cur_days) / days, 1), "avg_change": change(total("visitors", cur_days), total("visitors", prev_days)),
        "new": total("new_visitors", cur_days), "new_change": change(total("new_visitors", cur_days), total("new_visitors", prev_days)),
        "reads": reads, "reads_change": change(reads, total("reads", prev_days)),
        "avg_secs": round(read_secs / timed) if timed else None,
        "listens": total("listens", cur_days), "shares": total("shares", cur_days), "sources": total("sources", cur_days),
        "people": all_time["people"], "visits_all": all_time["visits"], "reads_all": all_time["reads"], "since": all_time["since"],
    }


def top_stories(stats, news, since: str, limit: int = 10, issue: str | None = None) -> list[dict]:
    where, args = ("issue = ?", (issue,)) if issue else ("day >= ?", (since,))
    rows = stats.execute(f"""SELECT issue, story, SUM(reads) reads, SUM(readers) readers, SUM(secs) secs, SUM(timed) timed, SUM(shares) shares, SUM(sources) sources
        FROM stories WHERE {where} GROUP BY issue, story ORDER BY readers DESC, reads DESC LIMIT ?""", (*args, limit)).fetchall()
    found = {r["id"]: r for r in news.execute(f"SELECT * FROM articles WHERE id IN ({','.join('?' * len(rows))})", [r["story"] for r in rows])} if rows else {}
    out = []
    for r in rows:
        a = found.get(r["story"])
        out.append({"issue": r["issue"], "id": r["story"], "title": fp.clean_headline(a["title"], a["source"]) if a else "(no longer stored)",
                    "source": a["source"] if a else "", "section": fp.SECTIONS.get(a["category"], a["category"]) if a else "", "link": a["canonical_url"] if a else "",
                    "reads": r["reads"], "readers": r["readers"], "avg_secs": round(r["secs"] / r["timed"]) if r["timed"] else None, "shares": r["shares"], "sources": r["sources"]})
    return out


# ---------- the news, from source to reader ----------

def news_flow(news, desk, stats, today: str, days: int) -> dict:
    span = day_list(today, days)
    start, _ = utc_bounds(span[0])
    per_day = {d: 0 for d in span}
    for (fetched,) in news.execute("SELECT fetched_at FROM articles WHERE fetched_at >= ?", (start,)):
        d = ist_day_of(fetched)
        if d in per_day:
            per_day[d] += 1
    count = lambda q, *a: news.execute(q, a).fetchone()[0]
    scraped = count("SELECT COUNT(*) FROM articles")
    dupes = count("SELECT COUNT(*) FROM articles WHERE reject_reason LIKE 'duplicate_of%'")
    off = count("SELECT COUNT(*) FROM articles WHERE reject_reason LIKE 'rules:%'")
    ignored = count("SELECT COUNT(*) FROM articles WHERE reject_reason = 'desk:ignored'")
    old = count("SELECT COUNT(*) FROM articles WHERE status='expired' AND reject_reason IS NULL")
    used = count("SELECT COUNT(*) FROM articles WHERE status='used'")
    read = stats.execute("SELECT COUNT(*) FROM (SELECT DISTINCT story FROM stories WHERE reads > 0)").fetchone()[0]
    funnel = [("Scraped", scraped), ("Not a duplicate", scraped - dupes), ("On brief", scraped - dupes - off), ("Still fresh", scraped - dupes - off - old),
              ("Published", used), ("Read by readers", min(read, used))]
    sections = {}
    for r in news.execute("SELECT category, COUNT(*) n FROM articles WHERE status='used' GROUP BY category"):
        name = fp.SECTIONS.get(r["category"], r["category"])
        sections[name] = sections.get(name, 0) + r["n"]
    since, _ = utc_bounds(today)
    sources = [dict(r) for r in news.execute("""SELECT source, COUNT(*) stored, SUM(fetched_at >= ?) today, SUM(status='used') used,
        SUM(reject_reason LIKE 'rules:%') off, SUM(reject_reason LIKE 'duplicate_of%') dupes, MAX(fetched_at) last FROM articles GROUP BY source ORDER BY used DESC, stored DESC""", (since,))]
    state = {r["source"]: r for r in news.execute("SELECT * FROM fetch_state")}
    for s in sources:
        st = state.get(s["source"])
        s["error"], s["last_ok"] = (st["last_error"], st["last_ok_at"]) if st else (None, None)
    return {"per_day": [(d, per_day[d]) for d in span], "funnel": funnel, "sections": sorted(sections.items(), key=lambda x: -x[1]), "sources": sources,
            "scraped": scraped, "today": per_day.get(today, 0), "dupes": dupes, "off": off, "old": old, "used": used, "ignored": ignored,
            "issues": count("SELECT COUNT(DISTINCT reject_reason) FROM articles WHERE status='used' AND reject_reason LIKE 'issue:%'"),
            "outcomes": [(label, n) for label, n in (("Published", used), ("Waiting for an issue", count("SELECT COUNT(*) FROM articles WHERE status IN ('new','selected_prime','selected_card','selected_glance')")),
                         ("Off brief", off), ("Too old", old), ("Duplicates", dupes), ("You ignored", ignored)) if n],
            "waiting": count("SELECT COUNT(*) FROM articles WHERE status IN ('new','selected_prime','selected_card','selected_glance')"),
            "range_total": sum(per_day.values())}


def issues(desk, stats, limit: int = 14) -> list[dict]:
    out = []
    mail = {r["issue"]: r for r in desk.execute("SELECT issue, SUM(status='sent') sent, SUM(status='failed') failed FROM email_log GROUP BY issue")}
    for r in desk.execute("SELECT * FROM issues ORDER BY date DESC LIMIT ?", (limit,)):
        s = stats.execute("SELECT COALESCE(SUM(reads),0) reads, COALESCE(SUM(readers),0) readers, COALESCE(SUM(secs),0) secs, COALESCE(SUM(timed),0) timed FROM stories WHERE issue=?", (r["date"],)).fetchone()
        visits = stats.execute("SELECT COALESCE(SUM(n),0) FROM dims WHERE dim='issue' AND value=?", (r["date"],)).fetchone()[0]
        m = mail.get(r["date"])
        out.append({"date": r["date"], "state": r["state"], "stories": len(json.loads(r["list"])) if r["list"] else 0, "live_at": r["live_at"],
                    "sent": (m["sent"] or 0) if m else 0, "failed": (m["failed"] or 0) if m else 0, "visits": visits, "reads": s["reads"],
                    "avg_secs": round(s["secs"] / s["timed"]) if s["timed"] else None})
    return out


# ---------- email ----------

def subscribers(desk, today: str, days: int) -> dict:
    status = {r["status"]: r["n"] for r in desk.execute("SELECT status, COUNT(*) n FROM subscribers GROUP BY status")}
    span = day_list(today, days)
    start, _ = utc_bounds(span[0])
    before = desk.execute("SELECT COUNT(*) FROM subscribers WHERE confirmed_at IS NOT NULL AND confirmed_at < ? AND (unsubscribed_at IS NULL OR unsubscribed_at >= ?)", (start, start)).fetchone()[0]
    joined, left = {d: 0 for d in span}, {d: 0 for d in span}
    for r in desk.execute("SELECT confirmed_at, unsubscribed_at FROM subscribers WHERE confirmed_at >= ? OR unsubscribed_at >= ?", (start, start)):
        if r["confirmed_at"] and ist_day_of(r["confirmed_at"]) in joined:
            joined[ist_day_of(r["confirmed_at"])] += 1
        if r["unsubscribed_at"] and r["confirmed_at"] and r["confirmed_at"] < r["unsubscribed_at"] and ist_day_of(r["unsubscribed_at"]) in left:
            left[ist_day_of(r["unsubscribed_at"])] -= 1
    running, line = before, []
    for d in span:
        running += joined[d] + left[d]
        line.append((d, running))
    sent = desk.execute("SELECT COALESCE(SUM(status='sent'),0), COALESCE(SUM(status='failed'),0) FROM email_log").fetchone()
    return {"status": status, "line": line, "joined": sum(joined.values()), "left": -sum(left.values()), "sent": sent[0], "failed": sent[1]}


# ---------- the server ----------

def _size(path: Path) -> int:
    if path.is_file():
        return path.stat().st_size
    total = 0
    for root, _, files in os.walk(path):
        for f in files:
            try:
                total += os.path.getsize(os.path.join(root, f))
            except OSError:
                pass
    return total


def server(desk, now: datetime) -> dict:
    data = dk.data_dir()
    try:
        load = os.getloadavg()
    except OSError:
        load = (0.0, 0.0, 0.0)
    disk = shutil.disk_usage(data)
    backups = sorted((p for p in (dk.ROOT / "backups").glob("*") if p.is_dir()), key=lambda p: p.stat().st_mtime) if (dk.ROOT / "backups").exists() else []
    jobs = []
    for j in desk.execute("SELECT * FROM jobs ORDER BY id DESC LIMIT 12"):
        took = None
        if j["ended_at"]:
            took = (datetime.strptime(j["ended_at"], "%Y-%m-%dT%H:%M:%SZ") - datetime.strptime(j["started_at"], "%Y-%m-%dT%H:%M:%SZ")).total_seconds()
        jobs.append({**dict(j), "took": took})
    week = dk.stamp(now - timedelta(days=7))
    return {"load": load[0], "cores": os.cpu_count() or 1, "disk_used": disk.used, "disk_total": disk.total,
            "data_bytes": sum(_size(p) for p in data.glob("*.db*")), "issues_bytes": _size(dk.public_dir() / "issues"),
            "backup_at": datetime.fromtimestamp(backups[-1].stat().st_mtime).astimezone(IST) if backups else None, "backups": len(backups),
            "uptime": time.time() - STARTED, "jobs": jobs,
            "failed_week": desk.execute("SELECT COUNT(*) FROM jobs WHERE status IN ('failed','stopped') AND started_at >= ?", (week,)).fetchone()[0]}


# ---------- every news ----------

NEWS_FILTERS = {
    "": ("Everything", "1"),
    "published": ("Published", "status='used'"),
    "waiting": ("Waiting for an issue", "status IN ('new','selected_prime','selected_card','selected_glance')"),
    "off": ("Off brief", "reject_reason LIKE 'rules:%'"),
    "duplicate": ("Duplicates", "reject_reason LIKE 'duplicate_of%'"),
    "ignored": ("You ignored", "reject_reason = 'desk:ignored'"),
    "old": ("Too old", "status='expired' AND reject_reason IS NULL"),
}
PAGE = 100


def what_happened(r) -> tuple[str, str]:
    """(label, tone) for one stored story."""
    reason, status = r["reject_reason"] or "", r["status"]
    if status == "used":
        if reason.startswith("issue:") and len(reason) == 16:
            d = Date.fromisoformat(reason[6:])
            return f"Published {d.strftime('%a')} {d.day} {d.strftime('%b')}", "ok"
        return "Published", "ok"
    if reason.startswith("duplicate_of"):
        return "Duplicate", "muted"
    if reason == "desk:ignored":
        return "You ignored it", "muted"
    if reason.startswith("rules:"):
        return "Off brief: " + reason.split(":", 1)[1], "muted"
    if status == "expired":
        return "Too old", "muted"
    if status.startswith("selected_"):
        return "Picked by the rules", "now"
    return "Waiting", "now"


def all_news(news, stats, q: dict) -> dict:
    show = q.get("show", "")
    if show not in NEWS_FILTERS:
        show = ""
    where, args = [NEWS_FILTERS[show][1]], []
    text = (q.get("q") or "").strip()[:100]
    if text:
        where.append("(title LIKE ? OR summary LIKE ?)")
        args += [f"%{text}%", f"%{text}%"]
    source = q.get("source", "")
    if source:
        where.append("source = ?")
        args.append(source)
    section = q.get("section", "")
    cats = [c for c, name in fp.SECTIONS.items() if name == section]
    if cats:
        where.append(f"category IN ({','.join('?' * len(cats))})")
        args += cats
    sql = " AND ".join(where)
    total = news.execute(f"SELECT COUNT(*) FROM articles WHERE {sql}", args).fetchone()[0]
    try:
        page = max(1, int(q.get("page", "1")))
    except ValueError:
        page = 1
    rows = news.execute(f"SELECT * FROM articles WHERE {sql} ORDER BY fetched_at DESC, published_at DESC LIMIT ? OFFSET ?", (*args, PAGE, (page - 1) * PAGE)).fetchall()
    ids = [r["id"] for r in rows]
    seen = {r["story"]: r for r in stats.execute(f"SELECT story, SUM(reads) reads, SUM(readers) readers, SUM(secs) secs, SUM(timed) timed, SUM(shares) shares, SUM(sources) sources FROM stories WHERE story IN ({','.join('?' * len(ids))}) GROUP BY story", ids)} if ids else {}
    items = []
    for r in rows:
        label, tone = what_happened(r)
        s = seen.get(r["id"])
        items.append({"id": r["id"], "title": fp.clean_headline(r["title"], r["source"]), "source": r["source"], "section": fp.SECTIONS.get(r["category"], r["category"]),
                      "link": r["canonical_url"], "fetched_at": r["fetched_at"], "published_at": r["published_at"], "score": r["score"], "what": label, "tone": tone,
                      "reads": s["reads"] if s else 0, "readers": s["readers"] if s else 0, "avg_secs": round(s["secs"] / s["timed"]) if s and s["timed"] else None,
                      "shares": s["shares"] if s else 0, "sources": s["sources"] if s else 0})
    counts = {k: news.execute(f"SELECT COUNT(*) FROM articles WHERE {cond}").fetchone()[0] for k, (_, cond) in NEWS_FILTERS.items()}
    return {"items": items, "total": total, "page": page, "pages": max(1, -(-total // PAGE)), "show": show, "q": text, "source": source, "section": section if cats else "",
            "counts": counts, "sources": [r[0] for r in news.execute("SELECT DISTINCT source FROM articles ORDER BY source")],
            "sections": sorted(set(fp.SECTIONS.values()))}
