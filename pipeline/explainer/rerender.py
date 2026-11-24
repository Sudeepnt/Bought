"""The desk's per-story buttons: re-render with another theme, or with the plan made by rules (for a story whose AI plan
failed the checks). Runs as a desk job at low priority; if the issue is already on the site it is published again."""
from __future__ import annotations

import json
from datetime import datetime, timezone

from .. import db, desk as dk, r2
from ..funnel import issue as fi, publish as fp
from ..ingest import iso
from . import build as eb, library, plan as planner


def run(cfg, date: str, story_id: str, theme: str | None = None, rules: bool = False, sources=(), conn=None, out_root=None, render_fn=None, speak=None, media=None) -> dict:
    conn = conn or db.connect(dk.data_dir() / "news.db")
    eb.connect(conn)
    conn.executescript(fi.SCHEMA)
    base = fi.issue_dir(date, out_root)
    issue = json.loads((base / "issue.json").read_text())
    item = next((i for i in issue["prime"] if i["id"] == story_id), None)
    if not item:
        return {"ok": False, "error": "that story has no video spot in this issue"}
    now = iso(datetime.now(timezone.utc))
    row = conn.execute("SELECT * FROM explainers WHERE issue=? AND article_id=?", (date, story_id)).fetchone()
    if theme:
        if theme not in library.theme_ids():
            return {"ok": False, "error": f"no theme {theme}"}
        eb._save(conn, date, story_id, now, theme_override=theme)
    elif row and row["theme"] and not row["theme_override"]:
        eb._save(conn, date, story_id, now, theme_override=row["theme"])      # keep the look it had
    if rules:
        p = planner.rules_plan(item, library.catalogue())
        errs = planner.check(p, item, planner.sources_for(item), library.catalogue(), cfg, rules=True)
        eb._save(conn, date, story_id, now, plan=p, plan_source="rules-chosen", checks=errs, status="needs_review" if errs else "planned",
                 decision=None if errs else "approve", note="the desk chose the plan made by rules")
    built, stats = eb.build(conn, cfg, date, issue, base, fi._stage, now, only={story_id}, render_fn=render_fn, speak=speak)
    feed_path = base / "feed.json"
    feed = json.loads(feed_path.read_text()) if feed_path.exists() else json.loads(json.dumps(issue))
    for slot in db.SLOTS:
        for it in feed[slot]:
            if it["id"] == story_id and story_id in built:
                it.update(built[story_id])
    fi.write_feed(feed, feed_path)
    published = None
    if story_id in built and dk.is_live_on_site(date):
        published = fp.publish(cfg, date, conn, len(sources), media=media if media is not None else r2.store())
    r = conn.execute("SELECT status, theme, error FROM explainers WHERE issue=? AND article_id=?", (date, story_id)).fetchone()
    return {"ok": story_id in built, "status": r["status"], "theme": r["theme"], "error": r["error"], "republished": bool(published), "stats": stats}
