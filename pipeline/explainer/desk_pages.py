"""The desk's explainer pages: /admin/explainers (the library gallery, the issue's explainers, portraits needed) and
/admin/explainers/story (one story: its plan, what the checks said, a preview, re-render with a theme, approve or hold).
Everything from a story or a plan is escaped. No script: forms and links only (the desk's CSP allows no inline script)."""
from __future__ import annotations

import json
from html import escape as e

from .. import admin_pages as pages

STATUS = {"planned": ("Planned", "warn"), "needs_review": ("Needs review", "bad"), "rendered": ("Made", "ok"), "failed": ("Failed", "bad")}


def _badge(status, decision):
    label, cls = STATUS.get(status or "", (status or "Not made yet", "warn"))
    if decision == "hold":
        label, cls = label + " · held", "bad"
    elif decision == "approve":
        label += " · approved"
    return f'<span class="note {cls}" style="display:inline-block;margin:0;padding:2px 8px">{e(label)}</span>'


def index(gal: dict, rows: list, needed: list, themes: list, theme: str, ratio: str, date: str, message="", error="") -> str:
    opts = "".join(f'<option value="{e(t["id"])}"{" selected" if t["id"] == theme else ""}>{t["n"]:02d} {e(t["name"])}</option>' for t in themes)
    pick = (f'<form method="get" action="/admin/explainers" class="row"><input type="hidden" name="date" value="{e(date)}"><label style="margin:0">Theme</label><select name="theme">{opts}</select>'
            f'<label style="margin:0">Ratio</label><select name="ratio"><option value="9x16"{" selected" if ratio == "9x16" else ""}>9:16</option><option value="16x9"{" selected" if ratio == "16x9" else ""}>16:9</option></select>'
            '<button class="b g">Show</button></form>')
    secs = lambda v: "" if v is None else f"{v:.0f} s"

    def line(r):
        link = f'/admin/explainers/story?date={e(date)}&id={e(r["article_id"])}'
        return (f'<tr><td class="n">{(r["rank"] or 0) + 1}</td><td><a href="{link}">{e(r["headline"] or r["article_id"])}</a></td><td>{e(r["section"] or "")}</td>'
                f'<td>{e(r["plan_source"] or "")}</td><td>{e(r["theme"] or r["theme_override"] or "")}</td><td>{_badge(r["status"], r["decision"])}</td>'
                f'<td class="n">{secs(r["duration_s"])}</td><td class="n">{secs(r["render_s"])}</td></tr>')
    story_rows = "".join(line(r) for r in rows) or '<tr><td colspan="8" class="empty">No explainers for this issue yet. They are made when you click Publish.</td></tr>'
    need = "".join(f'<tr><td>{e(n["name"])}</td><td class="n">{n["stories"]}</td><td>{pages.day(n["last"])}</td></tr>' for n in needed) or '<tr><td colspan="3" class="empty">None: everyone named so far has a portrait, or no one was named.</td></tr>'
    c = gal["counts"]
    body = f"""{pages.notes(message, error)}<style>{gal["css"]}</style>
<div class="row" style="justify-content:space-between"><div><h1>Explainers</h1><p class="sub">Every video is drawn by code from this library: {c["objects"]} drawings, {c["templates"]} scene templates, {c["themes"]} themes, {c["portraits"]} portraits. The AI only picks from it and writes the words.</p></div>{pages.date_links(date, "/explainers")}</div>
<div class="card wrap"><h2>This issue · {pages.day(date)}</h2><table><tr><th class="n">#</th><th>Story</th><th>Section</th><th>Plan</th><th>Theme</th><th>Status</th><th class="n">Length</th><th class="n">Render</th></tr>{story_rows}</table></div>
<div class="card wrap" id="portraits"><h2>Portraits needed</h2><p class="sub">People named in stories who have no portrait yet; their videos use initials. Add one from a public-domain or CC BY / BY-SA photo with <code>python -m pipeline explainer portrait add PHOTO --name … --source … --author … --license …</code>.</p><table><tr><th>Name</th><th class="n">Stories</th><th>Last named</th></tr>{need}</table></div>
<div class="card">{pick}</div>
{gal["html"]}"""
    return pages.shell("Explainers", "explainers", body, date)


def story(r: dict, prev: dict | None, themes: list, files: dict, date: str, message="", error="") -> str:
    plan = json.loads(r["plan"]) if r.get("plan") else None
    checks = json.loads(r["checks"]) if r.get("checks") else []
    missing = json.loads(r["missing"]) if r.get("missing") else []
    sid = r["article_id"]

    def form(path, label, cls="b", extra=""):
        return f'<form method="post" action="/admin/explainers/{path}"><input type="hidden" name="date" value="{e(date)}"><input type="hidden" name="id" value="{e(sid)}">{extra}<button class="{cls}">{label}</button></form>'
    opts = "".join(f'<option value="{e(t["id"])}"{" selected" if t["id"] == (r.get("theme_override") or r.get("theme")) else ""}>{t["n"]:02d} {e(t["name"])}</option>' for t in themes)
    buttons = (form("rerender", "Re-render with this theme", extra=f'<select name="theme">{opts}</select> ')
               + (form("decide", "Approve", "b g", '<input type="hidden" name="decision" value="approve">') if r.get("decision") != "approve" else "")
               + (form("decide", "Hold (no video)", "b g", '<input type="hidden" name="decision" value="hold">') if r.get("decision") != "hold" else form("decide", "Release hold", "b g", '<input type="hidden" name="decision" value="auto">'))
               + form("rerender", "Make it with the rules' plan", "b g", '<input type="hidden" name="rules" value="1">'))
    if checks:
        check_html = '<div class="note bad"><b>The checks failed:</b><ul>' + "".join(f"<li>{e(c)}</li>" for c in checks[:40]) + "</ul>This story gets no video until it passes, you approve it, or you make it with the rules' plan.</div>"
    else:
        check_html = '<div class="note ok">Passed every check: quotes word for word from the sources, every number, date and name in the sources, every id in the library.</div>' if plan else ""
    videos = "".join(f'<figure style="margin:0"><video src="/admin/explainers/file?date={e(date)}&id={e(sid)}&name={e(f["video"])}" poster="/admin/explainers/file?date={e(date)}&id={e(sid)}&name={e(f["poster"])}" controls preload="none" style="width:100%;max-height:70vh;background:#000;border-radius:8px"></video><figcaption>{e(k)} · {f["bytes"] // 1024:,} KB</figcaption></figure>' for k, f in files.items())
    prev_html = (f'<style>{prev["css"]}</style>{prev["html"]}') if prev else ""
    body = f"""{pages.notes(message, error)}<p><a href="/admin/explainers?date={e(date)}">‹ All explainers</a></p>
<h1>{e(r.get("headline") or sid)}</h1><p class="sub">{e(r.get("section") or "")} · plan by {e(r.get("plan_source") or "nobody yet")} · theme {e(r.get("theme") or r.get("theme_override") or "automatic")} · {_badge(r.get("status"), r.get("decision"))}</p>
{f'<p class="sub">{e(r["note"])}</p>' if r.get("note") else ""}{f'<div class="note bad">{e(r["error"])}</div>' if r.get("error") else ""}
{check_html}{f'<div class="note warn">No portrait yet for: {e(", ".join(missing))}. Initials are used.</div>' if missing else ""}
<div class="row" style="margin:10px 0 16px">{buttons}</div>
{f'<div class="card"><h2>The videos</h2><div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">{videos}</div></div>' if videos else ""}
<div class="card"><h2>Preview</h2><p class="sub">Every scene of the plan, drawn live in its theme.</p>{prev_html or '<p class="empty">No plan yet.</p>'}</div>
<div class="card"><h2>The plan</h2><pre>{e(json.dumps(plan, indent=1, ensure_ascii=False)) if plan is not None else "none"}</pre></div>"""
    return pages.shell("Explainer", "explainers", body, date)
