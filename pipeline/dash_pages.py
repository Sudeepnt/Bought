"""The desk's Dashboard and News pages. Everything from a feed is escaped: headlines are untrusted text."""
from __future__ import annotations

from datetime import datetime
from html import escape as e
from urllib.parse import urlencode
from zoneinfo import ZoneInfo

from . import admin_pages as pages
from . import charts as ch
from .charts import num
from .dashboard import NEWS_FILTERS

IST = ZoneInfo("Asia/Kolkata")

TIP_JS = r"""
const tip=document.getElementById("tip");
function show(el,x,y){tip.textContent=el.dataset.tip;tip.hidden=false;const r=tip.getBoundingClientRect();let l=x+14,t=y+14;if(l+r.width>innerWidth-8)l=x-r.width-14;if(t+r.height>innerHeight-8)t=y-r.height-14;tip.style.left=Math.max(8,l)+"px";tip.style.top=Math.max(8,t)+"px"}
function at(ev){const el=ev.target.closest&&ev.target.closest("[data-tip]");if(!el){tip.hidden=true;return}show(el,ev.clientX,ev.clientY)}
document.addEventListener("pointermove",at);document.addEventListener("pointerdown",at);
document.addEventListener("scroll",()=>{tip.hidden=true},{passive:true});
document.addEventListener("focusin",ev=>{const el=ev.target.closest&&ev.target.closest("[data-tip]");if(el){const r=el.getBoundingClientRect();show(el,r.left+r.width/2,r.top)}else tip.hidden=true});
"""

CSS = """
.dash h2{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}.dash h2 small{font:400 12.5px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:var(--muted)}
.range{display:inline-flex;background:#e6e0d2;border-radius:8px;padding:3px;gap:2px}.range a{padding:5px 12px;border-radius:6px;text-decoration:none;font-size:13.5px;font-weight:600;color:var(--muted)}.range a.on{background:var(--paper);color:var(--ink);box-shadow:0 1px 2px rgba(0,0,0,.08)}
.kpis{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px;margin-bottom:14px}
.kpi{background:var(--paper);border:1px solid var(--rule);border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:2px;min-height:112px}
.kpi span{font-size:12.5px;color:var(--muted)}.kpi b{font:600 30px/1.1 Georgia,serif;letter-spacing:-.01em}.kpi em{font-style:normal;font-size:12.5px;color:var(--muted)}
.kpi .up{color:#256b44}.kpi .down{color:#9b3a26}.kpi .spark{width:100%;height:28px;margin-top:auto}
.two{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:14px}.two>.card{margin-bottom:0}.two+.card,.two+.two{margin-top:14px}
.three{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr));gap:14px;margin-bottom:14px}.three>.card{margin-bottom:0}
.chart{display:block;width:100%;height:auto;overflow:visible}.chart .ax{font:11px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;fill:#857f74;font-variant-numeric:tabular-nums}.chart .val{font:600 12px -apple-system,BlinkMacSystemFont,sans-serif;fill:var(--ink)}
.chart .hit{fill:transparent;cursor:default}.chart .hl{fill:transparent}.chart .col:hover .hl{fill:rgba(29,27,24,.05)}.chart .pt line,.chart .pt circle{opacity:0}.chart .pt:hover line,.chart .pt:hover circle{opacity:1}
.legend{display:flex;gap:14px;flex-wrap:wrap;font-size:12.5px;color:var(--muted);margin:-4px 0 8px}.legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:-1px}
.hbars{display:flex;flex-direction:column;gap:7px}.hb{display:grid;grid-template-columns:minmax(80px,34%) 1fr;gap:10px;align-items:center;font-size:13px}.hb-l{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#3f3b34}
.hb-t{display:flex;align-items:center;gap:7px;min-width:0}.hb-t i{display:block;height:14px;border-radius:0 4px 4px 0;flex:none;max-width:calc(100% - 70px)}.hb-t b{font-weight:600;font-variant-numeric:tabular-nums}.hb-t small{color:var(--muted);font-size:11.5px}
.hb:hover .hb-l{color:var(--ink)}.fn .hb-l{font-weight:600}
#tip{position:fixed;z-index:50;pointer-events:none;background:var(--ink);color:#fbf8f1;font-size:12.5px;line-height:1.35;padding:6px 9px;border-radius:7px;max-width:280px;box-shadow:0 4px 14px rgba(0,0,0,.18)}
.alerts{display:flex;flex-direction:column;gap:6px;margin-bottom:14px}.alert{display:flex;gap:9px;align-items:flex-start;padding:9px 12px;border-radius:8px;font-size:14px}.alert .ic{font-weight:700;width:18px;text-align:center;flex:none}
.alert.serious{background:#f6dcd6;color:#7c2b1b}.alert.warning{background:#f5e9c9;color:#6a4d05}.alert.good{background:#dcebe0;color:#1f5535}
.pill{display:inline-block;padding:1px 8px;border-radius:99px;font-size:12px;white-space:nowrap}.pill.ok{background:#d7e8dc;color:#215a39}.pill.now{background:#f1e5c4;color:#6a4d05}.pill.muted{background:#e6e0d2;color:#5c574d}.pill.bad{background:#f6dcd6;color:#7c2b1b}
details.tbl{margin-top:8px;font-size:13px}details.tbl summary{cursor:pointer;color:var(--muted);font-size:12.5px}details.tbl table{margin-top:6px}
.facts{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px 18px;margin:0 0 12px}.facts div span{display:block;font-size:12px;color:var(--muted)}.facts div b{font:600 19px Georgia,serif}
.meter{height:8px;border-radius:99px;background:#e6e0d2;overflow:hidden;margin-top:5px}.meter i{display:block;height:100%;background:#2a78d6;border-radius:99px}.meter i.hot{background:#d03b3b}
.filters{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px}.filters input[type=search]{width:260px;max-width:100%}
.chips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}.chips a{padding:5px 11px;border-radius:99px;background:#e6e0d2;text-decoration:none;font-size:13px;font-weight:600;color:#4a453c}.chips a.on{background:var(--ink);color:#fff}.chips a i{font-style:normal;font-weight:400;opacity:.75;margin-left:4px}
td.hl a{text-decoration:none;font-family:Georgia,serif;font-size:14.5px}td.hl a:hover{text-decoration:underline}td.hl small{display:block;color:var(--muted);font-size:12px;margin-top:2px}
td.hl{min-width:240px}.dash td.n{white-space:nowrap}.cw{overflow-x:auto;-webkit-overflow-scrolling:touch}
@media (max-width:640px){.kpis{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.kpi{min-height:0;padding:10px 11px}.kpi b{font-size:24px}.kpi em{font-size:11.5px}
.cw .chart{min-width:620px}.cw.half .chart{min-width:440px}.range a{padding:5px 9px}.facts{grid-template-columns:repeat(2,minmax(0,1fr))}.hb{grid-template-columns:minmax(70px,38%) 1fr}}
.pager{display:flex;gap:8px;align-items:center;justify-content:space-between;margin-top:10px;font-size:13.5px;color:var(--muted)}
"""


def _tip_page(title: str, active: str, body: str, date: str) -> str:
    html = pages.shell(title, active, f'<div class="dash">{body}</div><div id="tip" role="tooltip" hidden></div><script>{TIP_JS}</script>', date)
    return html.replace("</style>", CSS + "</style>", 1)


def _delta(pct, word="than the period before") -> str:
    if pct is None:
        return "<em>nothing to compare yet</em>"
    if pct > 999:
        return f'<em><span class="up">▲ {pct // 100 + 1}×</span> {e(word.replace("than", "on"))}</em>'
    if pct == 0:
        return f"<em>same as {word.replace('than ', '')}</em>"
    return f'<em><span class="{"up" if pct > 0 else "down"}">{"▲" if pct > 0 else "▼"} {abs(pct)}%</span> {"more" if pct > 0 else "less"} {e(word)}</em>'


def kpi(label: str, value, foot: str = "", spark_values=None, tip: str = "") -> str:
    return (f'<div class="kpi"{f" data-tip={chr(34)}{e(tip)}{chr(34)}" if tip else ""}><span>{e(label)}</span><b>{value if isinstance(value, str) else num(value)}</b>{foot}'
            f'{ch.spark(spark_values) if spark_values else ""}</div>')


def secs(v) -> str:
    if v is None:
        return "–"
    v = int(v)
    return f"{v // 60}m {v % 60:02d}s" if v >= 60 else f"{v}s"


def size(n: int) -> str:
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if n < 1024 or unit == "TB":
            return f"{n:.0f} {unit}" if unit in ("B", "KB") else f"{n:.1f} {unit}"
        n /= 1024
    return ""


def pts(minor) -> str:
    return num(int(minor or 0) // 100)


def table(head: list[str], rows: list[list], numeric=(), story=None) -> str:
    """numeric: columns aligned right; story: the column that holds a headline."""
    cls = lambda i: ' class="n"' if i in numeric else ' class="hl"' if i == story else ""
    th = "".join(f'<th{" class=n" if i in numeric else ""}>{h}</th>' for i, h in enumerate(head))
    body = "".join("<tr>" + "".join(f"<td{cls(i)}>{c}</td>" for i, c in enumerate(r)) + "</tr>" for r in rows)
    return f'<div class="wrap"><table><tr>{th}</tr>{body}</table></div>'


def as_table(head: list[str], rows: list[list], numeric=()) -> str:
    return f'<details class="tbl"><summary>Show as a table</summary>{table(head, rows, numeric)}</details>'


def alerts(items: list[tuple[str, str]]) -> str:
    if not items:
        return '<div class="alerts"><div class="alert good"><span class="ic">✓</span><span>All good: sources fetching, jobs finishing, nothing waiting on you.</span></div></div>'
    icon = {"serious": "!", "warning": "▲"}
    return '<div class="alerts">' + "".join(f'<div class="alert {tone}"><span class="ic" aria-label="{tone}">{icon[tone]}</span><span>{text}</span></div>' for tone, text in items) + "</div>"


def dashboard(r: dict, flow: dict, top: list, issue_rows: list, subs: dict, server: dict, ads: dict, warnings: list, days: int, publish_hour: int,
              publish_label: str, now: datetime, date: str) -> str:
    series = r["series"]
    rng = "".join(f'<a href="/admin/dashboard?days={d}" class="{"on" if d == days else ""}">{d} days</a>' for d in (7, 30, 90))
    vs_yesterday = ch.num(r["today"] - r["yesterday"])
    today_foot = f'<em>{"+" if r["today"] >= r["yesterday"] else ""}{vs_yesterday} on yesterday ({num(r["yesterday"])})</em>'
    ads_kpi = kpi("Points sold to advertisers", pts(ads["bought_minor"]), f'<em>${pts(ads["bought_minor"])} in · {num(ads["advertisers"])} advertisers</em>',
                  [d["bought_minor"] / 100 for d in ads.get("days", [])][-days:]) if ads.get("live") else kpi("Ads", "Off", '<em>Not connected yet: see Ads</em>')
    status = subs["status"]
    kpis = "".join([
        kpi("Readers today", r["today"], today_foot, None, "People who opened the paper today (IST), each counted once"),
        kpi(f"Readers a day, last {days} days", r["avg"], _delta(r["avg_change"]), [d["visitors"] for d in series], "Average daily readers over the range"),
        kpi("Readers, all time", r["people"], f'<em>since {e(ch.long_day(r["since"])) if r["since"] else "the first visit"} · {num(r["new"])} new in range</em>', None,
            "First-time readers ever counted. Someone who clears their browser counts again"),
        kpi("Stories opened", r["reads"], _delta(r["reads_change"]), [d["reads"] for d in series]),
        kpi("Time on a story", secs(r["avg_secs"]), "<em>average, story open to close</em>"),
        kpi("Subscribers", status.get("confirmed", 0), f'<em>+{num(subs["joined"])} joined · {num(subs["left"])} left in range</em>', [v for _, v in subs["line"]]),
        kpi("Scraped today", flow["today"], f'<em>{num(flow["scraped"])} stored in all</em>', [v for _, v in flow["per_day"]]),
        kpi("Published stories", flow["used"], f'<em>in {num(flow["issues"])} issue{"" if flow["issues"] == 1 else "s"}</em>'),
        ads_kpi,
    ])

    readers_chart = ch.columns([(d["day"], [d["visitors"] - d["new_visitors"], d["new_visitors"]]) for d in series], [("Returning", ch.S1), ("New", ch.S2)],
                               lambda k, v: f"{ch.long_day(k)} · {num(sum(v))} readers ({num(v[1])} new, {num(v[0])} returning)", "Readers per day")
    readers_tbl = as_table(["Day", "Readers", "New", "Visits", "Stories opened", "Listened"], [[ch.long_day(d["day"]), num(d["visitors"]), num(d["new_visitors"]), num(d["visits"]), num(d["reads"]), num(d["listens"])] for d in reversed(series)], (1, 2, 3, 4, 5))
    hours = r["hours"]
    hours_chart = ch.columns([(f"{h:02d}", [v]) for h, v in enumerate(hours)], [("Visits", ch.S1)], lambda k, v: f"{k}:00–{k}:59 IST · {num(v[0])} visits", "Visits by hour, IST", height=200, label_every=3, mark=publish_hour, width=560)
    dims = r["dims"]
    view_names = {"paper": "Today (the paper)", "radio": "Listen", "advertise": "Advertise", "spec": "Build notes"}
    lang_names = {"en": "English", "hi": "Hindi", "ta": "Tamil", "te": "Telugu", "bn": "Bengali", "mr": "Marathi", "kn": "Kannada", "ml": "Malayalam", "gu": "Gujarati", "es": "Spanish", "fr": "French", "de": "German", "ja": "Japanese", "zh": "Chinese", "ar": "Arabic", "pt": "Portuguese"}
    named = lambda key, names: [(names.get(k, k), v) for k, v in dims.get(key, [])]
    opened = {}
    for key in ("first view", "view"):                  # where a visit started, plus each view opened later
        for k, v in dims.get(key, []):
            opened[k] = opened.get(k, 0) + v
    opened = sorted(((view_names.get(k, k), v) for k, v in opened.items()), key=lambda x: -x[1])

    top_rows = [[str(i), f'<a href="{pages.safe_link(s["link"])}" target="_blank" rel="noopener noreferrer">{e(s["title"])}</a><small>{e(s["section"])} · {e(s["source"])} · {e(ch.long_day(s["issue"]))}</small>',
                 num(s["readers"]), num(s["reads"]), secs(s["avg_secs"]), num(s["shares"]), num(s["sources"])] for i, s in enumerate(top, 1)]
    top_html = table(["#", "Story", "Readers", "Opens", "Avg time", "Shares", "To source"], top_rows, (0, 2, 3, 4, 5, 6), story=1) if top else '<p class="empty">No story has been opened in this range yet. Counts start when readers open stories on the live site.</p>'

    scraped_chart = ch.columns([(d, [v]) for d, v in flow["per_day"]], [("Scraped", ch.S1)], lambda k, v: f"{ch.long_day(k)} · {num(v[0])} stories scraped", "Stories scraped per day", height=200, width=560)
    src_rows = [[f'{e(s["source"])}{f"""<br><small style="color:var(--red)">{e(str(s["error"])[:100])}</small>""" if s["error"] else ""}', num(s["today"] or 0), num(s["stored"]), num(s["used"] or 0),
                 f'{(s["used"] or 0) / s["stored"]:.0%}' if s["stored"] else "–", num(s["off"] or 0), num(s["dupes"] or 0), pages.ist(s["last_ok"])] for s in flow["sources"]]
    issue_tbl = table(["Issue", "Stage", "Stories", "Visits", "Stories opened", "Avg time", "Emailed", "Failed"],
                      [[f'<a href="/admin/final?date={e(i["date"])}">{e(ch.long_day(i["date"]))}</a>', f'<span class="pill {"ok" if i["state"] == "live" else "bad" if i["state"] == "failed" else "now"}">{e(i["state"])}</span>',
                        num(i["stories"]), num(i["visits"]), num(i["reads"]), secs(i["avg_secs"]), num(i["sent"]), num(i["failed"])] for i in issue_rows], (2, 3, 4, 5, 6, 7)) if issue_rows else '<p class="empty">No issue has gone through the desk yet.</p>'

    subs_chart = (ch.line(subs["line"], lambda k, v: f"{ch.long_day(k)} · {num(v)} confirmed subscribers", "Confirmed subscribers", height=180)
                  if any(v for _, v in subs["line"]) else '<p class="empty">The subscriber chart starts with the first confirmed subscriber.</p>')
    mail_facts = "".join(f'<div><span>{label}</span><b>{num(v)}</b></div>' for label, v in (("Confirmed", status.get("confirmed", 0)), ("Waiting to confirm", status.get("pending", 0)),
                                                                                         ("Unsubscribed", status.get("unsubscribed", 0)), ("Emails sent", subs["sent"]), ("Emails failed", subs["failed"])))

    if ads.get("live"):
        ad_days = ads.get("days", [])
        ad_facts = "".join(f'<div><span>{label}</span><b>{v}</b></div>' for label, v in (
            ("Advertisers", num(ads["advertisers"])), ("Have bid", num(ads["bidders"])), ("Bids placed", num(ads["bids"])), ("Paid for points", num(ads["buyers"])),
            ("Points bought ($)", pts(ads["bought_minor"])), ("GST collected", "$" + pts(ads["tax_minor"])), ("Free points given", pts(ads["free_given_minor"])),
            ("Points spent on ads", pts(ads["spent_minor"])), ("…of them free", pts(ads["spent_free_minor"])), ("Spots sold", num(ads["spots_sold"])),
            ("Refunded (ad not ready)", num(ads["refunded"])), ("Points in wallets", pts(ads["held_minor"])), ("Withdrawals to pay", "$" + pts(ads["owed_minor"])), ("Paid out", "$" + pts(ads["withdrawn_minor"]))))
        ad_chart = ch.columns([(d["day"], [d["bought_minor"] / 100]) for d in ad_days], [("Points bought", ch.S2)], lambda k, v: f"{ch.long_day(k)} · {num(v[0])} points bought (${num(v[0])})", "Points bought per day", height=200, width=560)
        bids_chart = ch.columns([(d["day"], [d["bids"]]) for d in ad_days], [("Bids", ch.S1)], lambda k, v: f"{ch.long_day(k)} · {num(v[0])} bids", "Bids per day", height=200, width=560)
        open_rows = [[e(ch.long_day(o["issue"])), num(o["bidders"]), num(o["spots"]), pts(o["top_minor"])] for o in ads.get("open", [])]
        sold_rows = [[e(ch.long_day(i["issue"])), num(i["spots"]), pts(i["points_minor"]), pts(i["free_minor"]), num(i["views"]), num(i["plays"]), num(i["clicks"])] for i in ads.get("issues", [])]
        ads_html = f"""<div class="facts">{ad_facts}</div><div class="two"><div><h3 class="h3">Points bought per day</h3>{ad_chart}</div><div><h3 class="h3">Bids per day</h3>{bids_chart}</div></div>
<div class="two" style="margin-top:14px"><div><h3 class="h3">Auctions open now</h3>{table(["Issue", "Bidders", "Spots bid on", "Top bid (points)"], open_rows, (1, 2, 3)) if open_rows else '<p class="empty">No open bids.</p>'}</div>
<div><h3 class="h3">Sold, per issue</h3>{table(["Issue", "Spots", "Points", "Free", "Views", "Plays", "Clicks"], sold_rows, (1, 2, 3, 4, 5, 6)) if sold_rows else '<p class="empty">Nothing sold in this range.</p>'}</div></div>"""
    else:
        ads_html = f'<p class="empty">{e(ads.get("why") or "Ads are not connected yet.")} The numbers show here once they are. See <a href="/admin/ads">Ads</a>.</p>'

    load_pct = min(server["load"] / server["cores"], 1.5)
    disk_pct = server["disk_used"] / server["disk_total"] if server["disk_total"] else 0
    up = int(server["uptime"])
    job_rows = [[e(j["kind"]) + (" · " + e(j["issue"]) if j["issue"] else ""), f'<span class="pill {"ok" if j["status"] == "done" else "now" if j["status"] == "running" else "bad"}">{e(j["status"])}</span>',
                 pages.ist(j["started_at"]), secs(j["took"]) if j["took"] is not None else "–", f'<a href="/admin/log?job={j["id"]}">Log</a>'] for j in server["jobs"]]
    server_html = f"""<div class="facts">
<div><span>Load (1 min) on {server["cores"]} cores</span><b>{server["load"]:.2f}</b><div class="meter"><i class="{"hot" if load_pct > .7 else ""}" style="width:{min(load_pct, 1) * 100:.0f}%"></i></div></div>
<div><span>Disk used</span><b>{disk_pct:.0%}</b><div class="meter"><i class="{"hot" if disk_pct > .85 else ""}" style="width:{disk_pct * 100:.0f}%"></i></div></div>
<div><span>Databases</span><b>{size(server["data_bytes"])}</b></div><div><span>Published issues</span><b>{size(server["issues_bytes"])}</b></div>
<div><span>Last backup</span><b>{server["backup_at"].strftime("%d %b %H:%M") if server["backup_at"] else "None yet"}</b></div>
<div><span>Up for</span><b>{f"{up // 86400}d {up % 86400 // 3600}h" if up >= 86400 else f"{up // 3600}h {up % 3600 // 60}m"}</b></div></div>
<h3 class="h3">Recent jobs</h3>{table(["Job", "Status", "Started", "Took", ""], job_rows, (3,)) if job_rows else '<p class="empty">Nothing has run from here yet.</p>'}"""

    body = f"""<div class="row" style="justify-content:space-between;align-items:flex-end"><div><h1>Dashboard</h1><p class="sub">Everything on Bought, as of {now.astimezone(IST).strftime("%a %d %b, %H:%M")} IST. Days are IST days; the paper goes live at {e(publish_label)}.</p></div><nav class="range" aria-label="Range">{rng}</nav></div>
{alerts(warnings)}
<div class="kpis">{kpis}</div>
<div class="card"><h2>Readers per day <small>people who opened the paper, each counted once a day</small></h2><div class="legend"><span><i style="background:{ch.S1}"></i>Returning</span><span><i style="background:{ch.S2}"></i>New</span></div>{readers_chart}{readers_tbl}</div>
<div class="two"><div class="card"><h2>When readers come <small>visits by hour, IST; the line is when the paper goes live</small></h2>{hours_chart}</div>
<div class="card"><h2>Where they come from</h2>{ch.bars(dims.get("from", []))}</div></div>
<div class="three" style="margin-top:14px"><div class="card"><h2>Device</h2>{ch.bars(dims.get("device", []))}</div><div class="card"><h2>What they open</h2>{ch.bars(opened)}</div><div class="card"><h2>Reading language</h2>{ch.bars(named("lang", lang_names))}</div><div class="card"><h2>Time zones</h2>{ch.bars(dims.get("zone", []))}</div></div>
<div class="card"><h2>Top stories <small>by readers, last {days} days</small></h2>{top_html}<p class="hint" style="margin-top:8px"><a href="/admin/news?show=published">Every story and its numbers →</a></p></div>
<div class="card"><h2>The news, from source to reader <small>every story ever stored</small></h2>
<div class="two"><div>{ch.funnel(flow["funnel"])}<p class="hint" style="margin-top:10px">{num(flow["waiting"])} waiting for an issue · {num(flow["ignored"])} you ignored. <a href="/admin/news">See every story →</a></p></div>
<div><h3 class="h3">Scraped per day <small>{num(flow["range_total"])} in {days} days</small></h3>{scraped_chart}</div></div>
<div class="two" style="margin-top:14px"><div><h3 class="h3">Published, by section</h3>{ch.bars(flow["sections"], colour=ch.S1)}</div><div><h3 class="h3">What happened to every story</h3>{ch.bars(flow["outcomes"], colour=ch.S1, other=False)}</div></div></div>
<div class="card"><h2>Sources</h2>{table(["Source", "Today", "Stored", "Published", "Hit rate", "Off brief", "Duplicates", "Last OK"], src_rows, (1, 2, 3, 4, 5, 6)) if src_rows else '<p class="empty">No sources fetched yet.</p>'}</div>
<div class="card"><h2>Issues</h2>{issue_tbl}</div>
<div class="card"><h2>Email</h2><div class="facts">{mail_facts}</div>{subs_chart}</div>
<div class="card"><h2>Ads</h2>{ads_html}</div>
<div class="card"><h2>Server</h2>{server_html}</div>"""
    return _tip_page("Dashboard", "dash", body.replace('<h3 class="h3">', '<h3 class="h3" style="font:600 15px Georgia,serif;margin:0 0 8px">'), date)


def news_page(d: dict, date: str) -> str:
    link = lambda **over: "/admin/news?" + urlencode({k: v for k, v in {"show": d["show"], "q": d["q"], "source": d["source"], "section": d["section"], **over}.items() if v not in ("", None, 1)})
    chips = "".join(f'<a href="{e(link(show=k, page=None))}" class="{"on" if k == d["show"] else ""}">{e(label)}<i>{num(d["counts"][k])}</i></a>' for k, (label, _) in NEWS_FILTERS.items())
    opt = lambda values, chosen, blank: f'<option value="">{blank}</option>' + "".join(f'<option{" selected" if v == chosen else ""}>{e(v)}</option>' for v in values)
    rows = []
    for s in d["items"]:
        rows.append(f'<tr><td class="hl"><a href="{pages.safe_link(s["link"])}" target="_blank" rel="noopener noreferrer">{e(s["title"])}</a><small>{e(s["section"])} · {e(s["source"])} · published {pages.ist(s["published_at"])}</small></td>'
                    f'<td><span class="pill {s["tone"]}">{e(s["what"])}</span></td><td>{pages.ist(s["fetched_at"])}</td>'
                    f'<td class="n">{num(s["readers"]) if s["reads"] else "–"}</td><td class="n">{num(s["reads"]) if s["reads"] else "–"}</td><td class="n">{secs(s["avg_secs"])}</td><td class="n">{num(s["shares"]) if s["shares"] else "–"}</td></tr>')
    table_html = (f'<div class="wrap"><table><tr><th>Story</th><th>What happened</th><th>Scraped</th><th class="n">Readers</th><th class="n">Opens</th><th class="n">Avg time</th><th class="n">Shares</th></tr>{"".join(rows)}</table></div>'
                  if rows else '<p class="empty">No story matches.</p>')
    first = (d["page"] - 1) * 100 + 1 if d["total"] else 0
    pager = (f'<div class="pager"><span>{num(first)}–{num(first + len(d["items"]) - 1 if d["items"] else 0)} of {num(d["total"])}</span><span class="row">'
             + (f'<a class="b g" href="{e(link(page=d["page"] - 1))}">‹ Newer</a>' if d["page"] > 1 else "")
             + (f'<a class="b g" href="{e(link(page=d["page"] + 1))}">Older ›</a>' if d["page"] < d["pages"] else "") + "</span></div>")
    csv = "/admin/news.csv?" + urlencode({k: v for k, v in {"show": d["show"], "q": d["q"], "source": d["source"], "section": d["section"]}.items() if v})
    body = f"""<div class="row" style="justify-content:space-between;align-items:flex-end"><div><h1>All news</h1><p class="sub">Every story the funnel has stored, what happened to it, and how readers took it. Newest first.</p></div><a class="b g" href="{e(csv)}">Download as CSV</a></div>
<div class="chips">{chips}</div>
<form method="get" action="/admin/news" class="filters"><input type="hidden" name="show" value="{e(d["show"])}"><input type="search" name="q" value="{e(d["q"])}" placeholder="Search headlines and summaries" aria-label="Search">
<select name="section" aria-label="Section">{opt(d["sections"], d["section"], "All sections")}</select><select name="source" aria-label="Source">{opt(d["sources"], d["source"], "All sources")}</select><button class="b">Show</button>{f'<a class="b g" href="/admin/news?show={e(d["show"])}">Clear</a>' if d["q"] or d["source"] or d["section"] else ""}</form>
<div class="card">{table_html}{pager}</div>"""
    return _tip_page("All news", "news", body, date)
