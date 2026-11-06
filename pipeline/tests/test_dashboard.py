"""The reader counter (analytics.py), the Dashboard and All news pages, and what they promise about privacy."""
import json
import sqlite3
from datetime import datetime, timedelta, timezone

from pipeline import analytics, charts, dashboard as dash, dash_pages, desk as dk, security as sec, server
from test_desk import D, NOW, add, app_for, env, public, web  # noqa: F401  (pytest fixtures)

PHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1"
MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Safari/605.1.15"
AT = datetime(2026, 11, 6, 6, 30, tzinfo=timezone.utc)        # 12:00 IST on 6 Nov


def collector(tmp_path):
    return analytics.Collector(tmp_path / "stats.db", "bought.example")


def visit(c, ip="1.2.3.4", ua=PHONE, at=AT, **extra):
    return c.add({"k": "visit", "i": "2026-11-06", "v": "paper", "l": "en", "z": "Asia/Kolkata", **extra}, ip, ua, at)


def test_a_reader_counts_once_a_day_however_often_they_come(tmp_path):
    c = collector(tmp_path)
    for _ in range(5):
        visit(c)
    visit(c, n=True, ip="5.6.7.8", r="https://www.google.com/search?q=secret")
    visit(c, ua=MAC)                                             # same address, another browser: another person
    visit(c, at=AT + timedelta(days=1))                          # the next day counts again
    c.flush()
    db = c.connect()
    day = dict(db.execute("SELECT * FROM daily WHERE day='2026-11-06'").fetchone())
    assert (day["visitors"], day["visits"], day["new_visitors"]) == (3, 7, 1)
    assert db.execute("SELECT visitors FROM daily WHERE day='2026-11-07'").fetchone()[0] == 1
    dims = {(r["dim"], r["value"]): r["n"] for r in db.execute("SELECT * FROM dims WHERE day='2026-11-06'")}
    assert dims[("device", "Phone")] == 2 and dims[("device", "Computer")] == 1
    assert dims[("from", "Google")] == 1 and dims[("from", "Direct")] == 2
    assert tuple(db.execute("SELECT visitors, visits FROM hours WHERE day='2026-11-06' AND hour=12").fetchone()) == (3, 7)


def test_nothing_that_identifies_a_reader_is_stored(tmp_path):
    c = collector(tmp_path)
    visit(c, ip="203.0.113.77", r="https://example.org/private/page?user=asha")
    c.add({"k": "read", "i": "2026-11-06", "s": "9b997e4ce96388f2"}, "203.0.113.77", PHONE, AT)
    c.flush()
    c.add({"k": "visit", "i": "2026-11-08"}, "9.9.9.9", PHONE, AT + timedelta(days=2))   # two days on, the old hashes go
    c.flush()
    raw = b"".join(p.read_bytes() for p in tmp_path.glob("stats.db*"))
    for secret in (b"203.0.113.77", b"iPhone", b"private/page", b"user=asha"):
        assert secret not in raw
    db = c.connect()
    assert db.execute("SELECT COUNT(*) FROM seen WHERE day='2026-11-06'").fetchone()[0] == 0
    assert db.execute("SELECT COUNT(*) FROM salts WHERE day='2026-11-06'").fetchone()[0] == 0
    assert db.execute("SELECT value FROM dims WHERE dim='from' AND day='2026-11-06'").fetchone()[0] == "example.org"
    assert db.execute("SELECT visitors FROM daily WHERE day='2026-11-06'").fetchone()[0] == 1      # the totals stay


def test_bots_and_made_up_hits_are_not_counted(tmp_path):
    c = collector(tmp_path)
    assert not visit(c, ua="Googlebot/2.1 (+http://www.google.com/bot.html)")
    assert not visit(c, ua="")
    assert not visit(c, ua="curl/8.4.0")
    assert not c.add({"k": "drop table"}, "1.1.1.1", PHONE, AT)
    assert not c.add({"k": "read", "i": "2026-11-06", "s": "<script>"}, "1.1.1.1", PHONE, AT)
    assert not c.add({"k": "read", "i": "", "s": "9b997e4ce96388f2"}, "1.1.1.1", PHONE, AT)
    assert not c.add({"k": "view", "v": "admin"}, "1.1.1.1", PHONE, AT)
    assert not c.add({"k": "time", "i": "2026-11-06", "s": "9b997e4ce96388f2", "d": 99999}, "1.1.1.1", PHONE, AT)
    assert visit(c, l="<b>", z="Robert'); DROP", v="nope")
    c.flush()
    db = c.connect()
    assert db.execute("SELECT SUM(visits) FROM daily").fetchone()[0] == 1
    assert {r[0] for r in db.execute("SELECT value FROM dims WHERE dim='lang'")} == {"en"}
    assert db.execute("SELECT COUNT(*) FROM dims WHERE dim='zone'").fetchone()[0] == 0


def test_stories_count_opens_readers_time_shares_and_clicks_through(tmp_path):
    c = collector(tmp_path)
    s = {"i": "2026-11-06", "s": "9b997e4ce96388f2"}
    for ip in ("1.1.1.1", "1.1.1.1", "2.2.2.2"):
        c.add({"k": "read", **s}, ip, PHONE, AT)
    c.add({"k": "time", **s, "d": 40}, "1.1.1.1", PHONE, AT)
    c.add({"k": "time", **s, "d": 3000}, "2.2.2.2", PHONE, AT)     # a tab left open is capped
    c.add({"k": "share", **s}, "1.1.1.1", PHONE, AT)
    c.add({"k": "source", **s}, "2.2.2.2", PHONE, AT)
    c.add({"k": "listen", "i": "2026-11-06"}, "1.1.1.1", PHONE, AT)
    c.add({"k": "listen", "i": "2026-11-06"}, "1.1.1.1", PHONE, AT)
    c.flush()
    row = dict(c.connect().execute("SELECT * FROM stories").fetchone())
    assert (row["reads"], row["readers"], row["secs"], row["timed"], row["shares"], row["sources"]) == (3, 2, 1840, 2, 1, 1)
    day = dict(c.connect().execute("SELECT * FROM daily").fetchone())
    assert (day["reads"], day["readers"], day["listens"]) == (3, 2, 1)


def test_a_flood_is_dropped_not_held_in_memory(tmp_path, monkeypatch):
    monkeypatch.setattr(analytics, "QUEUE_MAX", 10)
    c = collector(tmp_path)
    assert sum(visit(c, ip=f"10.0.0.{i}") for i in range(25)) == 10
    assert c.dropped == 15
    assert c.flush() == 10


def test_the_page_endpoint_answers_204_and_counts_only_same_site(env, web, public):
    hit = json.dumps({"k": "visit", "i": "2026-11-06", "v": "paper"})
    r = public.call("POST", "/api/hit", hit, {"Content-Type": "text/plain", "User-Agent": PHONE})
    assert r.status == 204 and r.text == ""
    assert public.call("POST", "/api/hit", hit, {"Content-Type": "text/plain", "User-Agent": PHONE, "Origin": "https://evil.example"}).status == 204
    assert public.call("POST", "/api/hit", "not json", {"Content-Type": "text/plain", "User-Agent": PHONE}).status == 204
    assert web.app.stats.flush() == 1
    stats = sqlite3.connect(env.tmp / "data" / "stats.db")
    assert stats.execute("SELECT visits FROM daily").fetchone()[0] == 1


def test_one_address_cannot_flood_the_counts(env, web, public):
    hit = json.dumps({"k": "visit", "i": "2026-11-06"})
    for _ in range(310):
        public.call("POST", "/api/hit", hit, {"Content-Type": "text/plain", "User-Agent": PHONE, "X-Real-IP": "6.6.6.6"})
    assert web.app.stats.flush() == 300


def test_the_dashboard_and_news_pages_are_desk_only(env, web, public):
    for path in ("/admin/dashboard", "/admin/news", "/admin/news.csv"):
        assert public.call("GET", path).status == 404
        r = web.call("GET", path)
        assert r.status == 303 and r.headers["Location"] == "/admin/login"


def test_the_dashboard_shows_everything_and_escapes_headlines(env, web, monkeypatch):
    monkeypatch.setattr(web.app, "backend_call", lambda *a, **k: (0, {}))
    add(env.news, 9, status="used", title='<img src=x onerror="alert(1)"> Big launch')
    env.news.execute("UPDATE articles SET reject_reason='issue:2026-11-05' WHERE id='a9'")
    web.app.stats.add({"k": "visit", "i": "2026-11-05", "n": True, "r": "https://news.ycombinator.com/"}, "1.1.1.1", PHONE, NOW)
    web.app.stats.add({"k": "read", "i": "2026-11-05", "s": "a9" * 4}, "1.1.1.1", PHONE, NOW)
    web.app.stats.flush()
    cookie = web.login()
    r = web.call("GET", "/admin/dashboard?days=7", cookie=cookie)
    assert r.status == 200
    for words in ("Readers today", "Readers per day", "When readers come", "Hacker News", "The news, from source to reader", "Sources", "Issues", "Email", "Ads", "Server",
                  "Mail is not set up", "The ads backend is not running"):
        assert words in r.text, words
    assert "<img src=x" not in r.text
    csp = r.headers["Content-Security-Policy"]
    assert sec.script_hash(dash_pages.TIP_JS) in csp and "unsafe-inline" not in csp.split("script-src")[1].split(";")[0]
    assert web.call("GET", "/admin/dashboard?days=9999", cookie=cookie).status == 200      # an odd range falls back to 30 days

    news = web.call("GET", "/admin/news?show=published&q=launch", cookie=cookie)
    assert news.status == 200 and "Big launch" in news.text and "<img src=x" not in news.text and "Published Thu 5 Nov" in news.text
    assert "Story 1" not in news.text


def test_the_csv_cannot_smuggle_spreadsheet_formulas(env, web):
    add(env.news, 8, title='=HYPERLINK("http://evil.example","click")')
    r = web.call("GET", "/admin/news.csv", cookie=web.login())
    assert r.status == 200 and r.headers["Content-Type"].startswith("text/csv")
    assert "'=HYPERLINK" in r.text and "\n=HYPERLINK" not in r.text
    assert len(r.text.strip().splitlines()) == 1 + env.news.execute("SELECT COUNT(*) FROM articles").fetchone()[0]


def test_ads_numbers_come_from_the_backend_when_it_is_live(env, web, monkeypatch):
    stats = {"advertisers": 4, "bidders": 3, "bids": 12, "buyers": 2, "bought_minor": 4500, "tax_minor": 810, "free_given_minor": 40000, "spent_minor": 2300,
             "spent_free_minor": 1200, "spots_sold": 5, "refunded": 1, "held_minor": 6000, "owed_minor": 1000, "withdrawn_minor": 0,
             "days": [{"day": "2026-11-05", "advertisers": 1, "bids": 3, "bought_minor": 2500}], "issues": [{"issue": "2026-11-05", "spots": 5, "points_minor": 2300, "free_minor": 1200, "views": 900, "plays": 300, "clicks": 41}],
             "open": [{"issue": "2026-11-07", "bidders": 3, "spots": 2, "top_minor": 900}]}
    calls = []

    def backend(method, path, body=None):
        calls.append(path)
        return (200, {"live": True}) if path == "admin/status" else (200, stats)
    monkeypatch.setattr(web.app, "backend_call", backend)
    r = web.call("GET", "/admin/dashboard?days=7", cookie=web.login())
    assert "admin/stats?days=7" in calls
    for words in ("Points sold to advertisers", "Auctions open now", "Sold, per issue", "$10 of withdrawals to pay", "Free points given"):
        assert words in r.text, words


def test_the_dashboard_warns_when_an_issue_is_close_and_not_ready(env, web, monkeypatch):
    monkeypatch.setattr(web.app, "backend_call", lambda *a, **k: (0, {}))
    web.app.clock = lambda: datetime(2026, 11, 6, 0, 30, tzinfo=timezone.utc)        # 06:00 IST, an hour before 07:00 IST
    r = web.call("GET", f"/admin/dashboard", cookie=web.login())
    assert "goes live in 1h 0m and is still at <b>review</b>" in r.text


def test_the_news_funnel_and_outcomes_add_up(env):
    stats = analytics.Collector(env.tmp / "data" / "stats.db").connect()
    add(env.news, 20, status="used")
    add(env.news, 21, status="rejected")
    env.news.execute("UPDATE articles SET reject_reason='rules:off brief' WHERE id='a21'")
    add(env.news, 22, status="expired")
    flow = dash.news_flow(env.news, env.desk, stats, "2026-11-05", 7)
    assert flow["funnel"][:5] == [("Scraped", 9), ("Not a duplicate", 9), ("On brief", 8), ("Still fresh", 7), ("Published", 1)]
    assert dict(flow["outcomes"]) == {"Published": 1, "Waiting for an issue": 6, "Off brief": 1, "Too old": 1}
    assert flow["per_day"][-1] == ("2026-11-05", 9)


def test_charts_pick_round_axes_and_escape_tooltips():
    assert charts.nice_max(0) == (4, 1)
    assert charts.nice_max(93) == (100, 25)
    assert charts.nice_max(1234) == (1500, 500)
    svg = charts.columns([("2026-11-05", [3, 2])], [("A", charts.S1), ("B", charts.S2)], lambda k, v: '<x> & "y"', "t")
    assert 'data-tip="&lt;x&gt; &amp; &quot;y&quot;"' in svg
    assert charts.bars([(f"s{i}", 10 - i) for i in range(10)]).count('class="hb"') == 8      # the rest fold into Other
