"""The admin page's HTML. Everything from a feed is escaped: headlines are untrusted text."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from html import escape as e
from urllib.parse import quote as _quote
from zoneinfo import ZoneInfo

from . import desk as dk

STEPS = (("review", "Review"), ("finalized", "Finalized"), ("building", "Making videos"), ("ready", "Waiting for time"), ("live", "Live"))
SECTIONS = ("AI", "Technology", "Business", "Founders", "Launches", "Geopolitics")
SIZES = {"AI": 10, "Technology": 10, "Business": 10, "Founders": 10, "Launches": 5, "Geopolitics": 5}


def quote(v) -> str:
    return _quote(str(v), safe="")


def safe_link(url: str) -> str:
    return e(url) if str(url).startswith(("https://", "http://")) else "#"


def ist(value) -> str:
    """A stored UTC time, as the desk reads it."""
    if not value:
        return "–"
    try:
        d = datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    except ValueError:
        return e(str(value))
    return d.astimezone(ZoneInfo("Asia/Kolkata")).strftime("%d %b %H:%M IST")


def day(date: str) -> str:
    d = datetime.strptime(date, "%Y-%m-%d")
    return f"{d.strftime('%a')} {d.day} {d.strftime('%b')}"


CSS = """
:root{--ink:#1d1b18;--muted:#6f6a61;--rule:#ddd6c8;--paper:#fbf8f1;--desk:#f0ebe0;--red:#b4432b;--green:#2f7a4f;--amber:#a3730c}
*{box-sizing:border-box}body{margin:0;background:var(--desk);color:var(--ink);font:15px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif}
a{color:inherit}header.top{display:flex;gap:6px 18px;align-items:center;flex-wrap:wrap;padding:10px 20px;background:var(--ink);color:#fbf8f1}
header.top b{font:700 20px Georgia,serif}header.top b i{color:#e0766b;font-style:normal}header.top nav{display:flex;gap:4px;flex-wrap:wrap}
header.top a{padding:5px 10px;border-radius:6px;text-decoration:none;font-size:14px}header.top a.on,header.top a:hover{background:#3a362f}
header.top form{margin-left:auto}header.top button{background:none;border:1px solid #5c574d;color:#fbf8f1;padding:4px 10px;border-radius:6px;cursor:pointer;font:inherit;font-size:13px}
main{max-width:1120px;margin:0 auto;padding:18px 20px 60px}h1{font:600 26px Georgia,serif;margin:6px 0 2px}h2{font:600 18px Georgia,serif;margin:0 0 10px}
.sub{color:var(--muted);margin:0 0 14px}.card{background:var(--paper);border:1px solid var(--rule);border-radius:10px;padding:16px;margin-bottom:14px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px}.stat{background:var(--paper);border:1px solid var(--rule);border-radius:10px;padding:12px}
.stat b{display:block;font:600 28px/1.1 Georgia,serif}.stat span{font-size:12.5px;color:var(--muted)}
.steps{display:flex;flex-wrap:wrap;gap:6px;list-style:none;margin:0 0 12px;padding:0}.steps li{padding:5px 11px;border-radius:99px;background:#e6e0d2;color:var(--muted);font-size:13px}
.steps li.done{background:#d7e8dc;color:#215a39}.steps li.now{background:var(--ink);color:#fff}
table{width:100%;border-collapse:collapse;font-size:14px}th{text-align:left;font-weight:600;font-size:12px;color:var(--muted);border-bottom:1px solid var(--rule);padding:6px 8px}td{padding:7px 8px;border-bottom:1px solid #eee7d9;vertical-align:top}td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}.wrap{overflow-x:auto}
button.b,a.b{display:inline-block;background:var(--ink);color:#fff;border:0;border-radius:7px;padding:9px 15px;font:600 14px inherit;font-family:inherit;cursor:pointer;text-decoration:none}
button.g,a.g{background:none;color:var(--ink);border:1px solid #bdb5a4;font-weight:500}button.r{background:var(--red)}button:disabled{opacity:.5;cursor:default}.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.note{padding:10px 13px;border-radius:8px;margin-bottom:14px}.ok{background:#dcebe0;color:#1f5535}.bad{background:#f6dcd6;color:#7c2b1b}.warn{background:#f5e9c9;color:#6a4d05}
.tabs{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:10px}.tabs button{background:#e6e0d2;border:0;border-radius:7px;padding:8px 13px;font:inherit;font-weight:600;cursor:pointer}.tabs button.on{background:var(--ink);color:#fff}.tabs i{font-style:normal;opacity:.7;margin-left:4px;font-weight:400}
.story{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px 14px;padding:11px 2px;border-bottom:1px solid #eee7d9}.story h3{font:500 16px/1.3 Georgia,serif;margin:0}.story h3 a{text-decoration:none}.story h3 a:hover{text-decoration:underline}
.story p{margin:3px 0 0;color:var(--muted);font-size:13.5px}.meta{font-size:12px;color:var(--muted);margin-top:4px}.tag{display:inline-block;padding:0 6px;border-radius:4px;background:#e6e0d2;color:#4a453c;font-size:11.5px;margin-right:5px}.tag.me{background:#d7e8dc;color:#215a39}
.acts{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end;align-items:flex-start}.acts button{border:1px solid #bdb5a4;background:none;border-radius:6px;padding:5px 9px;font:500 12.5px inherit;font-family:inherit;cursor:pointer;white-space:nowrap}.acts .today{background:var(--green);border-color:var(--green);color:#fff}.acts .tom{border-color:var(--amber);color:var(--amber)}.acts .ign{color:var(--red);border-color:#d8a89e}
.bar{position:sticky;top:0;z-index:5;background:var(--desk);padding:8px 0;display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;justify-content:space-between}.secs{display:flex;flex-wrap:wrap;gap:6px;font-size:12.5px}.secs span{background:var(--paper);border:1px solid var(--rule);border-radius:6px;padding:3px 7px}.secs b{font-weight:600}.secs .over{color:var(--red)}.secs .under{color:var(--amber)}
label{display:block;font-size:13px;font-weight:600;margin:10px 0 4px}input,select{font:inherit;padding:8px 10px;border:1px solid #bdb5a4;border-radius:7px;background:#fff;max-width:100%}input[type=text],input[type=email],input[type=url],input[type=password]{width:100%;max-width:420px}.hint{font-size:12.5px;color:var(--muted);margin:3px 0 0}
pre{white-space:pre-wrap;word-break:break-word;font:12px/1.5 ui-monospace,Menlo,monospace;background:#1d1b18;color:#e8e2d4;padding:14px;border-radius:8px;max-height:70vh;overflow:auto}
.login{max-width:360px;margin:10vh auto;padding:0 16px}.empty{color:var(--muted);padding:18px 2px}
@media (max-width:640px){.story{grid-template-columns:minmax(0,1fr)}.acts{justify-content:flex-start}main{padding:12px 12px 50px}}
"""


def shell(title: str, active: str, body: str, date="", refresh=False) -> str:
    nav = "".join(f'<a href="/admin{p}{"?date=" + date if date and p != "/settings" else ""}" class="{"on" if active == k else ""}">{t}</a>' for k, p, t in (("home", "", "Overview"), ("review", "/review", "Review"), ("final", "/final", "Publish"), ("email", "/email", "Email"), ("ads", "/ads", "Ads"), ("settings", "/settings", "Settings")))
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>{e(title)} · Bought. admin</title>{'<meta http-equiv="refresh" content="10">' if refresh else ''}<style>{CSS}</style></head><body>
<header class="top"><b>Bought<i>.</i> admin</b><nav>{nav}</nav><form method="post" action="/admin/logout"><button>Sign out</button></form></header><main>{body}</main></body></html>"""


def notes(message="", error="") -> str:
    return (f'<div class="note ok">{e(message)}</div>' if message else "") + (f'<div class="note bad">{e(error)}</div>' if error else "")


def steps(stage: str) -> str:
    current = "building" if stage == "failed" else stage
    order = [k for k, _ in STEPS]
    at = order.index(current) if current in order else 0
    return '<ol class="steps">' + "".join(f'<li class="{"now" if i == at else "done" if i < at else ""}">{t}</li>' for i, (_, t) in enumerate(STEPS)) + "</ol>"


def date_links(date: str, page: str) -> str:
    return f'<span class="row"><a class="b g" href="/admin{page}?date={dk.add_days(date, -1)}">‹ {day(dk.add_days(date, -1))}</a><a class="b g" href="/admin{page}?date={dk.add_days(date, 1)}">{day(dk.add_days(date, 1))} ›</a></span>'


def login(error="") -> str:
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Sign in · Bought. admin</title><style>{CSS}</style></head><body><div class="login"><h1>Bought. admin</h1>{notes("", error)}<form method="post" action="/admin/login" class="card"><label for="p">Password</label><input id="p" type="password" name="password" autofocus autocomplete="current-password" required><p style="margin:14px 0 0"><button class="b">Sign in</button></p></form></div></body></html>"""


def dashboard(data, jobs, issues, mail_ready, date, stage, settings, row, job, now, message, error) -> str:
    stat = lambda n, label: f'<div class="stat"><b>{n:,}</b><span>{label}</span></div>' if isinstance(n, int) else f'<div class="stat"><b>{e(str(n))}</b><span>{label}</span></div>'
    src = "".join(f'<tr><td>{e(s["name"])}{f"""<br><small style="color:var(--red)">{e(str(s["error"])[:120])}</small>""" if s["error"] else ""}</td><td class="n">{s["today"]:,}</td><td class="n">{s["total"]:,}</td><td class="n">{"–" if s["last_seen"] is None else s["last_seen"]}</td><td class="n">{"–" if s["last_new"] is None else s["last_new"]}</td><td>{ist(s["last_ok"])}</td></tr>' for s in data["sources"])
    job_rows = "".join(f'<tr><td>{e(j["kind"])}{" · " + e(j["issue"]) if j["issue"] else ""}</td><td>{e(j["status"])}</td><td>{ist(j["started_at"])}</td><td>{ist(j["ended_at"])}</td><td><a href="/admin/log?job={j["id"]}">Log</a></td></tr>' for j in jobs) or '<tr><td colspan="5" class="empty">Nothing has run from here yet.</td></tr>'
    issue_rows = "".join(f'<tr><td><a href="/admin/final?date={e(i["date"])}">{day(i["date"])}</a></td><td>{e(i["state"])}</td><td class="n">{len(json.loads(i["list"])) if i["list"] else 0}</td><td>{ist(i["live_at"])}</td><td>{ist(i["emailed_at"])}</td></tr>' for i in issues) or '<tr><td colspan="5" class="empty">No issue has gone through the desk yet.</td></tr>'
    subs = data["subscribers"]
    warn = ""
    if not mail_ready:
        warn += '<div class="note warn">Mail is not set up, so no email can go out yet. See <a href="/admin/email">Email</a>.</div>'
    if not settings["site_url"]:
        warn += '<div class="note warn">The site address is not set, so email links and share links have nowhere to point. See <a href="/admin/settings">Settings</a>.</div>'
    busy = f'<div class="note warn">Running now: {e(job["kind"])}{" for " + e(job["issue"]) if job["issue"] else ""}, since {ist(job["started_at"])}. <a href="/admin/log?job={job["id"]}">Log</a></div>' if job else ""
    action = {"review": ("/review", "Review the news"), "finalized": ("/final", "See the final list"), "building": ("/final", "See progress"), "ready": ("/final", "See what's waiting"), "failed": ("/final", "See what failed"), "live": ("/final", "See this issue")}[stage]
    body = f"""{notes(message, error)}{warn}{busy}
<div class="row" style="justify-content:space-between"><div><h1>Issue of {day(date)}</h1><p class="sub">Goes live at {e(dk.publish_label(settings))}. Last fetch: {ist(data["last_run_at"])}.</p></div>{date_links(date, "")}</div>
{steps(stage)}
<div class="row" style="margin-bottom:16px"><a class="b" href="/admin{action[0]}?date={date}">{action[1]}</a><form method="post" action="/admin/fetch"><input type="hidden" name="date" value="{date}"><button class="b g"{" disabled" if job else ""}>Fetch news now</button></form></div>
<h2>Where the news went</h2><div class="grid" style="margin-bottom:14px">
{stat(data["scraped_today"], "scraped today")}{stat(data["scraped_total"], "scraped, all stored")}{stat(data["duplicates"], "duplicates removed")}{stat(data["off_brief"], "off brief or promotions")}{stat(data["too_old"], "too old")}{stat(data["on_brief"], "important: on brief now")}{stat(data["chosen"], "chosen for this issue")}{stat(data["left"], "left over")}{stat(data["tomorrow"], "held for later")}{stat(data["ignored"], "ignored in this issue")}{stat(data["finalized"], "finalized")}{stat(data["used"], "already used in issues")}
</div>
<h2>Readers</h2><div class="grid" style="margin-bottom:14px">{stat(subs.get("confirmed", 0), "subscribers confirmed")}{stat(subs.get("pending", 0), "waiting to confirm")}{stat(subs.get("unsubscribed", 0), "unsubscribed")}</div>
<div class="card"><h2>Issues</h2><div class="wrap"><table><tr><th>Date</th><th>Stage</th><th class="n">Stories</th><th>Live</th><th>Emailed</th></tr>{issue_rows}</table></div></div>
<div class="card"><h2>Sources</h2><div class="wrap"><table><tr><th>Source</th><th class="n">Today</th><th class="n">Stored</th><th class="n">Last fetch saw</th><th class="n">New</th><th>Last OK</th></tr>{src}</table></div></div>
<div class="card"><h2>Jobs</h2><div class="wrap"><table><tr><th>Job</th><th>Status</th><th>Started</th><th>Ended</th><th></th></tr>{job_rows}</table></div></div>"""
    return shell("Overview", "home", body, date, refresh=bool(job))


REVIEW_JS = r"""
const date=document.body.dataset.date;
const ACTS={chosen:[["ignore","Ignore","ign"],["tomorrow","Use tomorrow","tom"]],left:[["today","Use today","today"],["tomorrow","Use tomorrow","tom"],["ignore","Ignore","ign"]],tomorrow:[["today","Use today","today"],["ignore","Ignore","ign"]],ignored:[["today","Use today","today"],["tomorrow","Use tomorrow","tom"]]};
const MOVE={today:"chosen",tomorrow:"tomorrow",ignore:"ignored"};
const list=n=>document.getElementById("list-"+n);
function paint(row,where){row.dataset.list=where;row.querySelector(".acts").innerHTML=ACTS[where].map(([a,t,c])=>`<button type="button" class="${c}" data-act="${a}">${t}</button>`).join("")}
function counts(){
 for(const n of Object.keys(ACTS)){const c=list(n).querySelectorAll(".story").length;document.getElementById("n-"+n).textContent=c;list(n).querySelector(".empty").hidden=c>0}
 const total=list("chosen").querySelectorAll(".story").length,target=+document.body.dataset.target;
 const t=document.getElementById("total");t.textContent=`${total} of ${target} chosen`;t.className=total>target?"over":total<target?"under":"";
 document.querySelectorAll("[data-sec-count]").forEach(el=>{const name=el.dataset.secCount,size=+el.dataset.size,n=list("chosen").querySelectorAll(`.story[data-sec="${name}"]`).length;el.querySelector("b").textContent=n;el.className=n>size?"over":n<size?"under":""});
 document.getElementById("finalize").disabled=!total;
}
document.querySelectorAll(".story").forEach(r=>paint(r,r.closest("[data-name]").dataset.name));
document.addEventListener("click",async ev=>{
 const tab=ev.target.closest("[data-tab]");
 if(tab){document.querySelectorAll("[data-tab]").forEach(b=>b.classList.toggle("on",b===tab));document.querySelectorAll("[data-name]").forEach(l=>l.hidden=l.dataset.name!==tab.dataset.tab);return}
 const b=ev.target.closest("[data-act]");if(!b)return;
 const row=b.closest(".story"),action=b.dataset.act;b.disabled=true;
 const r=await fetch("/admin/api/decide",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:row.dataset.id,action,date})}).catch(()=>null);
 const res=r&&await r.json().catch(()=>null);
 if(!r||!r.ok||!res||!res.ok){b.disabled=false;alert((res&&res.error)||"That didn't save. Check the connection and try again.");return}
 paint(row,MOVE[action]);list(MOVE[action]).prepend(row);counts();
});
document.getElementById("sec").addEventListener("change",e=>{const v=e.target.value;document.querySelectorAll(".story").forEach(r=>r.hidden=!!v&&r.dataset.sec!==v)});
counts();
"""


def _row(s: dict) -> str:
    tags = (f'<span class="tag">{e(s["section"])}</span><span class="tag">{e(s["source"])}</span>' + ('<span class="tag me">Your pick</span>' if s.get("mine") else "") + (f'<span class="tag me">For {day(s["held_for"])}</span>' if s.get("held_for") else ""))
    return f'<article class="story" data-id="{e(s["id"])}" data-sec="{e(s["section"])}"><div><h3><a href="{safe_link(s["link"])}" target="_blank" rel="noopener noreferrer">{e(s["title"])}</a></h3>{f"""<p>{e(s["summary"])}</p>""" if s["summary"] else ""}<div class="meta">{tags} {ist(s["published_at"])}</div></div><div class="acts"></div></article>'


def review(board, date, stage, settings, row, job, now, message, error) -> str:
    labels = (("chosen", "Chosen"), ("left", "Left over"), ("tomorrow", "Held for later"), ("ignored", "Ignored"))
    tabs = "".join(f'<button type="button" data-tab="{k}" class="{"on" if k == "chosen" else ""}">{t}<i id="n-{k}">{len(board[k])}</i></button>' for k, t in labels)
    blank = {"chosen": "Nothing chosen yet. Fetch the news, or pick from Left over.", "left": "Nothing left over.", "tomorrow": "Nothing held.", "ignored": "Nothing ignored in this issue."}
    lists = "".join(f'<section id="list-{k}" data-name="{k}"{"" if k == "chosen" else " hidden"} class="card">{"".join(_row(s) for s in board[k])}<p class="empty">{blank[k]}</p></section>' for k, _ in labels)
    secs = "".join(f'<span data-sec-count="{n}" data-size="{SIZES[n]}">{n} <b>0</b>/{SIZES[n]}</span>' for n in SECTIONS)
    options = '<option value="">All sections</option>' + "".join(f"<option>{n}</option>" for n in SECTIONS)
    body = f"""{notes(message, error)}<div class="row" style="justify-content:space-between"><div><h1>Review: {day(date)}</h1><p class="sub">The rules chose these. Change anything; your choices stay even when more news comes in. Left-over stories you don't touch can still come up tomorrow.</p></div>{date_links(date, "/review")}</div>
<div class="bar"><div class="secs"><span id="total"></span>{secs}</div><form method="post" action="/admin/finalize" class="row"><input type="hidden" name="date" value="{date}"><select id="sec" aria-label="Section">{options}</select><button class="b" id="finalize">Finalize this list</button></form></div>
<div class="tabs">{tabs}</div>{lists}<script>{REVIEW_JS}</script>"""
    return shell("Review", "review", body, date).replace("<body>", f'<body data-date="{date}" data-target="{e(settings["target_stories"])}">')


def final(stories, due, date, stage, settings, row, job, now, message, error) -> str:
    def form(path, label, cls="b", extra="", confirm=""):
        click = f' onclick="return confirm({e(json.dumps(confirm), quote=True)})"' if confirm else ""
        return f'<form method="post" action="/admin{path}"><input type="hidden" name="date" value="{date}">{extra}<button class="{cls}"{click}>{label}</button></form>'
    when = due.strftime("%a %d %b, %H:%M ") + settings["publish_zone"]
    late = now >= due
    held = bool(row and row["held"])
    info, buttons, refresh = "", "", False
    if stage == "review":
        info = '<div class="note warn">This list isn\'t finalized yet.</div>'
        buttons = f'<a class="b" href="/admin/review?date={date}">Go to review</a>'
    elif stage == "finalized":
        info = f'<div class="note warn">This is the final list. Publish makes the videos and audio from exactly these stories, then it goes live at <b>{e(when)}</b>{" (that time has passed, so as soon as it is ready)" if late else ""}.</div>'
        disabled = bool(job)
        buttons = form("/publish", f"Publish these {len(stories)} stories", extra="") + form("/reopen", "Back to review", "b g")
        if disabled:
            info += f'<div class="note warn">Another job is running ({e(job["kind"])}). Publish when it finishes.</div>'
    elif stage == "building":
        refresh = True
        link = f' <a href="/admin/log?job={job["id"]}">Watch the log</a>.' if job else ""
        info = f'<div class="note warn">In the publish stage: making videos and audio. This takes a while, and the list can no longer change.{link}</div>'
    elif stage == "failed":
        info = f'<div class="note bad">{e(row["error"] or "Something failed.")}</div>'
        buttons = form("/retry", "Try again") + form("/reopen", "Back to review", "b g")
    elif stage == "ready" and row and row["go_now"]:
        refresh = True
        info = '<div class="note ok">Going live now. The page updates by itself.</div>'
    elif stage == "ready":
        info = f'<div class="note ok">Ready. {"<b>On hold:</b> it will not go out until you release it." if held else f"Goes live at <b>{e(when)}</b>, then the email goes out."}</div>'
        buttons = form("/publish-now", "Publish now", confirm="Put this issue on the site and email subscribers now?") + (form("/hold", "Release hold", "b g", '<input type="hidden" name="held" value="0">') if held else form("/hold", "Hold", "b g", '<input type="hidden" name="held" value="1">')) + form("/reopen", "Back to review", "b g", confirm="Reopen the list? Finished videos are kept only if the same story stays at the same rank.")
    elif stage == "live":
        sent = f" Emailed {ist(row['emailed_at'])}." if row and row["emailed_at"] else ""
        info = f'<div class="note ok">This issue is live.{sent}</div>'
    stats = ""
    if row and row["stats"]:
        stats = '<p class="sub">Last build: ' + e(", ".join(f"{k} {v}" for k, v in json.loads(row["stats"]).items())) + (f'. Languages: {e(row["languages"])}.' if row["languages"] else ".") + "</p>"
    items = "".join(f'<tr><td class="n">{n}</td><td>{f"""<a href="{safe_link(s["link"])}" target="_blank" rel="noopener noreferrer">{e(s["title"])}</a>"""}</td><td>{e(s["section"])}</td><td>{e(s["source"])}</td></tr>' for n, s in enumerate(stories, 1)) or '<tr><td colspan="4" class="empty">No list for this date.</td></tr>'
    body = f"""{notes(message, error)}<div class="row" style="justify-content:space-between"><div><h1>Publish: {day(date)}</h1><p class="sub">{len(stories)} stories</p></div>{date_links(date, "/final")}</div>{steps(stage)}{info}{stats}<div class="row" style="margin-bottom:14px">{buttons}</div>
<div class="card wrap"><table><tr><th class="n">#</th><th>Story</th><th>Section</th><th>Source</th></tr>{items}</table></div>"""
    return shell("Publish", "final", body, date, refresh=refresh)


def email(subs, sends, failures, mail_ready, has_issue, date, stage, settings, row, job, now, message, error) -> str:
    status = '<div class="note ok">Mail is set up.</div>' if mail_ready else """<div class="note warn"><b>Mail is not set up, so nothing can be sent.</b> On the server set BOUGHT_SMTP_HOST and BOUGHT_SMTP_FROM, plus BOUGHT_SMTP_USER, BOUGHT_SMTP_PASS and BOUGHT_SMTP_PORT if your service needs them, then restart. People can still subscribe and will wait as pending.</div>"""
    site = "" if settings["site_url"] else '<div class="note warn">Set the site address in <a href="/admin/settings">Settings</a> too: email links need it.</div>'
    send_rows = "".join(f'<tr><td>{e(s["issue"])}</td><td class="n">{s["sent"] or 0}</td><td class="n">{s["failed"] or 0}</td></tr>' for s in sends) or '<tr><td colspan="3" class="empty">No issue emailed yet.</td></tr>'
    fail_rows = "".join(f'<tr><td>{e(f["issue"])}</td><td>{e(f["email"])}</td><td>{e(f["error"] or "")}</td></tr>' for f in failures)
    sub_rows = "".join(f'<tr><td>{e(s["email"])}</td><td>{e(s["status"])}</td><td>{ist(s["created_at"])}</td><td>{ist(s["confirmed_at"])}</td></tr>' for s in subs) or '<tr><td colspan="4" class="empty">No subscribers yet.</td></tr>'
    tools = f"""<div class="card"><h2>The email</h2><div class="row"><a class="b g" href="/admin/email/preview" target="_blank" rel="noopener">Preview the latest issue's email</a></div>
<form method="post" action="/admin/email/test" style="margin-top:12px"><input type="hidden" name="date" value="{date}"><label for="to">Send a test to</label><div class="row"><input id="to" type="email" name="to" required placeholder="you@company.com"><button class="b g"{"" if mail_ready else " disabled"}>Send test</button></div></form>
<form method="post" action="/admin/email/retry" style="margin-top:12px"><input type="hidden" name="date" value="{date}"><button class="b g"{"" if mail_ready and stage == "live" else " disabled"}>Send {day(date)} to anyone not sent yet</button><p class="hint">Never sends the same issue to the same person twice.</p></form></div>""" if has_issue else ""
    body = f"""{notes(message, error)}<h1>Email</h1><p class="sub">The issue goes to confirmed subscribers as soon as it goes live.</p>{status}{site}{tools}
<div class="card"><h2>Sent</h2><div class="wrap"><table><tr><th>Issue</th><th class="n">Sent</th><th class="n">Failed</th></tr>{send_rows}</table></div>{f'<h2 style="margin-top:16px">Failures</h2><div class="wrap"><table><tr><th>Issue</th><th>Address</th><th>Why</th></tr>{fail_rows}</table></div>' if fail_rows else ""}</div>
<div class="card"><h2>Subscribers</h2><div class="wrap"><table><tr><th>Address</th><th>Status</th><th>Signed up</th><th>Confirmed</th></tr>{sub_rows}</table></div></div>"""
    return shell("Email", "email", body, date)


def money(minor) -> str:
    return f"${int(minor or 0) / 100:,.0f}"


def ad_card(ad: dict) -> str:
    """Everything an advertiser typed is escaped, and only http(s) links are drawn."""
    f = ad.get("fields") or {}
    aid = e(str(ad.get("id", "")))
    media = ""
    if ad.get("mux_playback_id") and ad.get("token"):
        stream = f"https://stream.mux.com/{quote(ad['mux_playback_id'])}.m3u8?token={quote(ad['token'])}"
        media = f'<video controls playsinline preload="none" data-stream="{e(stream)}" style="width:100%;max-width:520px;border-radius:8px;background:#000"></video>'
    elif ad.get("signedImage") and ad.get("kind") == "image":
        media = f'<img src="{safe_link(ad["signedImage"])}" alt="" style="max-width:320px;border-radius:8px">'
    links = " · ".join(f'<a href="{safe_link(f[k])}" rel="noopener noreferrer" target="_blank">{e(k)}</a>' for k in ("web", "social", "link") if f.get(k))
    lines = "".join(f"<div><b>{e(label)}:</b> {e(str(f[k]))}</div>" for k, label in (("line", "Line"), ("about", "About"), ("thumb", "Thumbnail text"), ("who", "On screen"), ("email", "Email")) if f.get(k))
    transcript = ""
    if ad.get("kind") == "video":
        status = ad.get("transcription_status", "pending")
        if ad.get("transcript_english"):
            transcript = f'<p><b>Transcript</b> (check names, quotes and claims against the video)</p><p class="hint">{e(ad["transcript_english"])}</p>'
        else:
            detail = f': {e(ad["transcription_error"])}' if ad.get("transcription_error") else ""
            transcript = f'<p class="hint">Transcript: {e(status)}{detail}. It has to finish before this ad can be approved.</p>'
            if ad.get("state") == "review":
                transcript += f'<form method="post" action="/admin/ads/transcribe"><input type="hidden" name="ad" value="{aid}"><button class="b g">Ask Mux again</button></form>'
    if ad.get("state") != "review":
        actions = '<p class="hint">Waiting for Mux to finish the video.</p>'
    else:
        actions = f"""<div class="row"><form method="post" action="/admin/ads/review"><input type="hidden" name="ad" value="{aid}"><input type="hidden" name="approve" value="1"><button class="b">Approve</button></form>
<form method="post" action="/admin/ads/review" class="row"><input type="hidden" name="ad" value="{aid}"><input type="hidden" name="approve" value="0"><input name="reason" maxlength="500" placeholder="What needs changing" aria-label="What needs changing" required><button class="b r">Send back</button></form></div>"""
    return f"""<div class="card"><h2>{e(str(ad.get("advertiser") or "Advertiser"))} · {e(str(ad.get("spot", "")))}</h2><p class="sub">{e(str(ad.get("email") or ""))} · {e(str(ad.get("kind", "")))} {("· " + links) if links else ""}</p>{media}{lines}{transcript}{actions}</div>"""


def ads_page(running, status, queue, date, stage, settings, row, job, now, message, error) -> str:
    if not running:
        body = '<h1>Ads</h1><div class="note warn">The backend is not running. Run <code>npm install</code> in <code>backend/</code>, then restart the server.</div>'
        return shell("Ads", "ads", notes(message, error) + body, date)
    if not status.get("live"):
        missing = "".join(f"<li><code>{e(str(k))}</code></li>" for k in status.get("missing", []))
        body = f"""<h1>Ads</h1><div class="note warn">Not connected yet, so the Advertise page is still running its simulation: nothing real can be bid, recorded or paid for.</div>
<div class="card"><h2>Still needed in backend/.env</h2><ul>{missing}</ul><p class="hint">Payments are separate. Stripe: {"ready" if status.get("providers", {}).get("stripe") else "not set"}. Razorpay: {"ready" if status.get("providers", {}).get("razorpay") else "not set"}.</p></div>"""
        return shell("Ads", "ads", notes(message, error) + body, date)
    ads = queue.get("ads") or []
    cards = "".join(ad_card(a) for a in ads) or '<div class="card empty">Nothing is waiting for review.</div>'
    sold = "".join(f'<tr><td>{day(str(s["issue"])[:10])}</td><td>{e(s["spot"])}</td><td>{money(s["price_minor"])}</td><td>{e(s["status"])}</td><td>{e(s["invoice"])}</td></tr>' for s in queue.get("sold") or [])
    sold = f'<div class="card"><h2>Sold</h2><table><tr><th>Issue</th><th>Spot</th><th>Price</th><th>Status</th><th>Invoice</th></tr>{sold}</table></div>' if sold else ""
    money_out = "".join(f"""<tr><td>{money(w["amount_minor"])}</td><td>{e(str(w["requested_at"])[:16])}</td><td><form method="post" action="/admin/ads/withdrawal"><input type="hidden" name="id" value="{e(str(w["id"]))}"><button class="b g">Mark as paid</button></form></td></tr>""" for w in queue.get("withdrawals") or [])
    money_out = f'<div class="card"><h2>Withdrawals to pay by hand</h2><table><tr><th>Amount</th><th>Asked</th><th></th></tr>{money_out}</table></div>' if money_out else ""
    body = f"""{notes(message, error)}<h1>Ads</h1><p class="sub">{len(ads)} waiting. Every ad needs a person to approve it before 04:00 IST on its issue day. By 05:00 an unapproved ad loses its spot to the next bidder.</p>{cards}{money_out}{sold}<script type="module" src="/js/live/admin-player.js?v=10"></script>"""
    return shell("Ads", "ads", body, date)


def settings_page(date, stage, settings, row, job, now, message, error) -> str:
    zone = "".join(f'<option{" selected" if z == settings["publish_zone"] else ""}>{z}</option>' for z in dk.ZONES)
    body = f"""{notes(message, error)}<h1>Settings</h1><form method="post" action="/admin/settings" class="card"><input type="hidden" name="date" value="{date}">
<label for="t">Publish time</label><div class="row"><input id="t" type="time" name="publish_time" value="{e(settings["publish_time"])}" required><select name="publish_zone" aria-label="Time zone">{zone}</select></div><p class="hint">Every issue goes live and is emailed at this time on its date. Advertiser bidding closes at 22:00 IST the night before (the auction is still simulated, so the clock doesn't check it yet).</p>
<label for="n">Stories per issue</label><input id="n" type="number" min="1" name="target_stories" value="{e(settings["target_stories"])}"><p class="hint">The count you aim for on the Review page. The rules' section sizes are in pipeline/brief.yaml.</p>
<label for="rh">Reader hours after publishing</label><input id="rh" type="number" min="0" max="20" name="reader_hours" value="{e(settings["reader_hours"])}"><p class="hint">For this many hours after the paper goes out, the server keeps its power for readers: automatic fetching and translating wait, and start once it is quiet. Your own clicks (Fetch news now, Publish) still run at once, at low priority.</p>
<label for="f">Fetch news every (minutes)</label><input id="f" type="number" min="0" name="auto_fetch_minutes" value="{e(settings["auto_fetch_minutes"])}"><p class="hint">0 is off: it only fetches when you click Fetch news now. At least 15 otherwise.</p>
<label for="s">Site address</label><input id="s" type="url" name="site_url" value="{e(settings["site_url"])}" placeholder="https://yourdomain.com"><p class="hint">Used in email links and share links.</p>
<label for="a">Postal address for the email footer</label><input id="a" type="text" name="mail_address" value="{e(settings["mail_address"])}"><p class="hint">Bulk-mail rules in many countries ask for one.</p>
<p style="margin:16px 0 0"><button class="b">Save</button></p></form>"""
    return shell("Settings", "settings", body, date)


def log_page(job, text, date, stage, settings, row, now, message, error) -> str:
    title = f'{e(job["kind"])} · {ist(job["started_at"])} · {e(job["status"])}' if job else "No such job"
    return shell("Log", "home", f'<h1>{title}</h1><pre>{e(text) or "Nothing written yet."}</pre>', date, refresh=bool(job and job["status"] == "running"))


# ---------- pages for readers ----------

def _plain(title: str, inner: str) -> str:
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>{e(title)}</title><style>{CSS}</style></head><body><div class="login"><h1>Bought<span style="color:var(--red)">.</span></h1><div class="card">{inner}</div></div></body></html>"""


def mail_page(action: str, token: str) -> str:
    """A button, not an automatic action: mail scanners open every link, and that must not confirm or unsubscribe anyone."""
    text, label = ("Confirm your subscription to the daily issue.", "Confirm") if action == "confirm" else ("Stop the daily issue going to this address?", "Unsubscribe")
    return _plain(label, f'<p>{text}</p><form method="post" action="/{action}?t={quote(token)}"><button class="b">{label}</button></form>')


def mail_done(action: str, ok: bool) -> str:
    if not ok:
        return _plain("Link not valid", "<p>This link isn't valid any more.</p>")
    return _plain("Done", '<p>You\'re subscribed. The next issue will reach you.</p><p><a href="/">Read today\'s issue</a></p>' if action == "confirm" else '<p>You\'re unsubscribed. No more issues will be sent.</p><p><a href="/">Back to the paper</a></p>')
