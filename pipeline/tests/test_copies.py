"""Keep a copy: a copy holds everything, comes back exactly, refuses anything damaged, and never leaves the server half-way."""
import hashlib
import http.client
import json
import sqlite3
import threading
import time
import zipfile
from datetime import datetime, timezone
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
from types import SimpleNamespace

import pytest

from pipeline import copies, db, desk as dk, mailer, server

NOW = datetime(2026, 11, 11, 6, 30, tzinfo=timezone.utc)


@pytest.fixture
def env(tmp_path, monkeypatch):
    for k, sub in (("BOUGHT_DATA", "data"), ("BOUGHT_OUT", "out"), ("BOUGHT_PUBLIC", "public"), ("BOUGHT_RESTORE", "restore")):
        monkeypatch.setenv(k, str(tmp_path / sub))
    monkeypatch.setenv("BOUGHT_ADMIN_PASSWORD", "correct horse")
    data, out, pub = tmp_path / "data", tmp_path / "out", tmp_path / "public"
    (pub / "issues" / "2026-11-10" / "media").mkdir(parents=True)
    (pub / "index.html").write_text("the paper")
    (pub / "issues" / "index.json").write_text(json.dumps({"latest": "2026-11-10"}))
    (pub / "issues" / "2026-11-10" / "issue.json").write_text(json.dumps({"date": "2026-11-10", "stories": [1, 2]}))
    (pub / "issues" / "2026-11-10" / "media" / "a.mp4").write_bytes(bytes(range(256)) * 400)
    (pub / "s" / "a1").mkdir(parents=True)
    (pub / "s" / "a1" / "index.html").write_text("<p>share</p>")
    (out / "issues" / "2026-11-10" / "work").mkdir(parents=True)
    (out / "issues" / "2026-11-10" / "work" / "a.wav").write_bytes(b"RIFF" + b"\x01" * 5000)
    (out / "issues" / "2026-11-10" / "feed.json").write_text(json.dumps({"image": str(data / "images" / "a.jpg")}))
    (data / "images").mkdir(parents=True)
    (data / "images" / "a.jpg").write_bytes(b"\xff\xd8" + b"\x07" * 3000)
    (data / "logs").mkdir()
    (data / "logs" / "job.log").write_text("fetched 12\n")
    (data / "translations.json").write_text(json.dumps({"hi": {"a1": "नमस्ते"}}, ensure_ascii=False))
    (data / "admin_password.txt").write_text("old machine password\n")
    (data / "admin_session_key").write_text("old machine key\n")
    news = db.connect(data / "news.db")
    news.execute("INSERT INTO articles (id, canonical_url, source, category, source_weight, title, summary, published_at, fetched_at, status, score) VALUES ('a1','https://x.test/1','TechCrunch','AI',5,'Story one','A summary.','2026-11-10T06:00:00Z','2026-11-10T06:00:00Z','new',90)")
    desk = dk.connect()
    mailer.subscribe(desk, "reader@example.com", NOW)
    desk.execute("INSERT INTO jobs (kind, status, started_at, log) VALUES ('intake','done','2026-11-10T05:00:00Z',?)", (str(data / "logs" / "job.log"),))
    dk.save_settings(desk, {"publish_time": "07:00"})
    return SimpleNamespace(tmp=tmp_path, data=data, out=out, pub=pub, news=news, desk=desk)


def tree(env) -> dict:
    """What the server holds: every file's hash, and every database as its rows."""
    res = {}
    for section, root in copies.sections():
        for rel, path in copies._files(section, root):
            if copies.is_db(path):
                conn = sqlite3.connect(path)
                res[f"{section}/{rel}"] = list(conn.iterdump())
                conn.close()
            else:
                res[f"{section}/{rel}"] = hashlib.sha256(path.read_bytes()).hexdigest()
    return res


def make(env, name="copy.zip") -> Path:
    path = env.tmp / name
    copies.export(path, NOW)
    return path


def test_a_copy_holds_everything_and_never_the_sign_in_secrets(env):
    path = make(env)
    names = set(zipfile.ZipFile(path).namelist())
    for want in ("data/news.db", "data/desk.db", "data/images/a.jpg", "data/logs/job.log", "data/translations.json", "out/issues/2026-11-10/work/a.wav",
                 "public/issues/index.json", "public/issues/2026-11-10/media/a.mp4", "public/s/a1/index.html", "manifest.json"):
        assert want in names, want
    assert not {n for n in names if n.endswith(("admin_password.txt", "admin_session_key", "-wal", "-shm"))}
    m = copies.check(path)
    info = copies.summary(m)
    assert info["subscribers"] == 1 and info["stories"] == 1 and info["issues"] == 1 and info["latest"] == "2026-11-10"
    assert "public/index.html" not in names                                   # the site's own code comes from git


def test_putting_a_copy_back_brings_everything_back_exactly(env):
    before = tree(env)
    path = make(env)
    # the server goes on: new stories, a new subscriber, a lost picture, a new issue
    env.news.execute("DELETE FROM articles")
    mailer.subscribe(env.desk, "late@example.com", NOW)
    (env.data / "images" / "a.jpg").unlink()
    (env.pub / "issues" / "2026-11-11").mkdir()
    (env.pub / "issues" / "2026-11-11" / "issue.json").write_text("{}")
    (env.data / "extra.txt").write_text("made after the copy")
    (env.data / "admin_password.txt").write_text("this machine's password\n")
    assert tree(env) != before
    copies.import_copy(path, NOW)
    assert tree(env) == before
    # connections the server already has open see the copy at once
    assert env.news.execute("SELECT COUNT(*) FROM articles").fetchone()[0] == 1
    assert [r["email"] for r in env.desk.execute("SELECT email FROM subscribers")] == ["reader@example.com"]
    assert (env.data / "admin_password.txt").read_text() == "this machine's password\n"   # the sign-in stays this machine's
    assert dk.get_settings(env.desk)["publish_time"] == "07:00"


def test_an_import_can_be_undone_and_the_undo_too(env):
    path = make(env)
    mailer.subscribe(env.desk, "late@example.com", NOW)
    (env.out / "issues" / "2026-11-11").mkdir()
    (env.out / "issues" / "2026-11-11" / "new.txt").write_text("new")
    after = tree(env)
    copies.import_copy(path, NOW)
    assert tree(env) != after
    assert copies.restore_point()["label"] == "before-import"
    copies.undo_import(NOW)
    assert tree(env) == after
    assert copies.restore_point()["label"] == "before-undo"
    copies.undo_import(NOW)
    assert "out/issues/2026-11-11/new.txt" not in tree(env)
    assert len([p for p in (env.tmp / "restore").iterdir() if p.name.startswith("point-")]) == 1      # one restore point, not a pile


def test_a_damaged_copy_is_refused_and_nothing_changes(env):
    path = make(env)
    damaged = env.tmp / "damaged.zip"
    with zipfile.ZipFile(path) as src, zipfile.ZipFile(damaged, "w") as dst:
        for info in src.infolist():
            data = src.read(info)
            if info.filename == "data/translations.json":
                data = data.replace("नमस्ते".encode(), "hello".encode().ljust(len("नमस्ते".encode())))
            dst.writestr(info, data)
    mailer.subscribe(env.desk, "late@example.com", NOW)
    now = tree(env)
    with pytest.raises(copies.CopyError, match="checksum"):
        copies.import_copy(damaged, NOW)
    assert tree(env) == now
    cut = env.tmp / "cut.zip"
    cut.write_bytes(path.read_bytes()[: path.stat().st_size // 2])
    with pytest.raises(copies.CopyError, match="not a Bought copy|cut short"):
        copies.check(cut)
    assert tree(env) == now


def _forge(env, files: dict, manifest_extra=None, sections=("data",)) -> Path:
    path = env.tmp / "forged.zip"
    entries = [{"path": k, "size": len(v), "sha256": hashlib.sha256(v).hexdigest()} for k, v in files.items()]
    m = {"kind": "bought-copy", "format": 1, "sections": list(sections), "roots": copies.roots(), "files": entries, **(manifest_extra or {})}
    with zipfile.ZipFile(path, "w") as z:
        for k, v in files.items():
            z.writestr(k, v)
        z.writestr("manifest.json", json.dumps(m))
    return path


@pytest.mark.parametrize("name", ["data/../escape.txt", "/etc/passwd", "data//x", "data/./x", "elsewhere/x", "data\\..\\x"])
def test_names_that_could_land_outside_are_refused(env, name):
    with pytest.raises(copies.CopyError):
        copies.import_copy(_forge(env, {name: b"x"}), NOW)
    assert not (env.tmp / "escape.txt").exists()


def test_other_zips_and_newer_copies_are_refused(env):
    other = env.tmp / "other.zip"
    with zipfile.ZipFile(other, "w") as z:
        z.writestr("photo.jpg", b"x")
    with pytest.raises(copies.CopyError, match="no manifest"):
        copies.check(other)
    with pytest.raises(copies.CopyError, match="newer version"):
        copies.check(_forge(env, {"data/a.txt": b"x"}, {"format": 99}))
    with pytest.raises(copies.CopyError, match="not listed"):
        p = _forge(env, {"data/a.txt": b"x"})
        with zipfile.ZipFile(p, "a") as z:
            z.writestr("data/sneaked.txt", b"y")
        copies.check(p)
    (env.tmp / "notzip.zip").write_bytes(b"hello")
    with pytest.raises(copies.CopyError, match="not a zip"):
        copies.check(env.tmp / "notzip.zip")


def test_a_copy_from_another_machine_points_its_paths_here(env, tmp_path):
    path = make(env)
    old = str(env.data)
    copies.import_copy(path, NOW)                       # same machine: nothing to change
    # pretend the copy came from /srv/bought: rewrite its manifest's roots
    moved = env.tmp / "moved.zip"
    with zipfile.ZipFile(path) as src, zipfile.ZipFile(moved, "w") as dst:
        for info in src.infolist():
            data = src.read(info)
            if info.filename == "manifest.json":
                m = json.loads(data)
                m["roots"] = {"root": "/srv/bought", "data": "/srv/bought/pipeline/data", "out": "/srv/bought/pipeline/out", "public": "/srv/bought/public"}
                data = json.dumps(m).encode()
            dst.writestr(info, data)
    # and that its files name that machine's paths
    copies_dir = env.tmp / "staged"
    copies.check(moved, into=copies_dir)
    conn = sqlite3.connect(copies_dir / "data" / "desk.db")
    conn.execute("UPDATE jobs SET log='/srv/bought/pipeline/data/logs/job.log'")
    conn.commit()
    conn.close()
    feed = copies_dir / "out" / "issues" / "2026-11-10" / "feed.json"
    feed.write_text(json.dumps({"image": "/srv/bought/pipeline/data/images/a.jpg", "url": "https://site/srv/bought/pipeline/data/x"}))
    n = copies.rewrite_paths(copies_dir, {"root": "/srv/bought", "data": "/srv/bought/pipeline/data", "out": "/srv/bought/pipeline/out", "public": "/srv/bought/public"}, copies.roots())
    assert n >= 2
    conn = sqlite3.connect(copies_dir / "data" / "desk.db")
    assert conn.execute("SELECT log FROM jobs").fetchone()[0] == f"{old}/logs/job.log"
    conn.close()
    assert json.loads(feed.read_text())["image"] == f"{old}/images/a.jpg"


def test_a_failure_half_way_puts_everything_back(env, monkeypatch):
    path = make(env)
    mailer.subscribe(env.desk, "late@example.com", NOW)
    (env.pub / "issues" / "2026-11-11").mkdir()
    now = tree(env)
    real, calls = copies._move, []

    def flaky(a, b):
        calls.append((a, b))
        if len(calls) == 5:
            raise OSError("disk went away")
        return real(a, b)
    monkeypatch.setattr(copies, "_move", flaky)
    with pytest.raises(copies.CopyError, match="nothing was changed"):
        copies.import_copy(path, NOW)
    monkeypatch.setattr(copies, "_move", real)
    assert tree(env) == now
    assert (env.pub / "issues" / "2026-11-11").is_dir()
    assert copies.restore_point() is None


def test_not_enough_disk_is_said_before_anything_starts(env, monkeypatch):
    path = make(env)
    monkeypatch.setattr(copies, "_free", lambda p: 1000)
    with pytest.raises(copies.CopyError, match="Not enough free disk"):
        copies.export(env.tmp / "again.zip", NOW)
    with pytest.raises(copies.CopyError, match="Not enough free disk"):
        copies.import_copy(path, NOW)


# ---------- over the desk ----------
@pytest.fixture
def web(env):
    app = server.App(clock=lambda: NOW, runner=lambda *a: None)
    server.Handler.app = app
    srv = ThreadingHTTPServer(("127.0.0.1", 0), partial(server.Handler, directory=str(env.pub)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    port = srv.server_address[1]

    def call(method, path, body=None, cookie=None, origin=True, ctype="application/x-www-form-urlencoded"):
        c = http.client.HTTPConnection("127.0.0.1", port, timeout=30)
        h = {"Content-Type": ctype}
        if cookie:
            h["Cookie"] = cookie
        if origin and method == "POST":
            h["Origin"] = f"http://127.0.0.1:{port}"
        c.request(method, path, body, h)
        r = c.getresponse()
        data = r.read()
        c.close()
        return SimpleNamespace(status=r.status, body=data, text=data.decode(errors="replace"), headers=r.headers)

    r = call("POST", "/admin/login", "password=correct+horse")
    cookie = r.headers["Set-Cookie"].split(";")[0]
    yield SimpleNamespace(call=call, cookie=cookie, app=app, port=port)
    srv.shutdown()


def test_download_check_and_import_over_the_desk(web, env):
    page = web.call("GET", "/admin/dashboard", cookie=web.cookie).text
    assert "Keep a copy" in page and 'id="copy-file"' in page and "Never from this page" in page
    r = web.call("GET", "/admin/copy/export?t=abc123", cookie=web.cookie)
    assert r.status == 200 and r.headers["Content-Type"] == "application/zip"
    assert "attachment" in r.headers["Content-Disposition"] and "bought_copy=abc123" in r.headers["Set-Cookie"]
    file = env.tmp / "downloaded.zip"
    file.write_bytes(r.body)
    assert not list((env.tmp / "restore").glob(".export-*"))                  # the server keeps no copy of it
    before = tree(env)
    for _ in range(50):                                   # the time is written just after the last byte goes out
        if dk.get_settings(env.desk).get("copy_downloaded_at"):
            break
        time.sleep(0.05)
    assert "Last downloaded: 11 Nov 12:00 IST" in web.call("GET", "/admin/dashboard", cookie=web.cookie).text

    mailer.subscribe(env.desk, "late@example.com", NOW)
    r = web.call("POST", "/admin/copy/check", file.read_bytes(), cookie=web.cookie, ctype="application/zip")
    got = json.loads(r.text)
    assert r.status == 200 and got["ok"] and ["Subscribers", "1"] in got["facts"]
    assert web.call("POST", "/admin/copy/import", json.dumps({"id": got["id"]}), cookie=web.cookie, origin=False, ctype="application/json").status == 403
    r = web.call("POST", "/admin/copy/import", json.dumps({"id": got["id"]}), cookie=web.cookie, ctype="application/json")
    assert r.status == 200 and json.loads(r.text)["ok"]
    after = tree(env)
    # the desk records the download time in its own settings, which the copy predates: everything else is identical
    assert {k: v for k, v in after.items() if k != "data/desk.db"} == {k: v for k, v in before.items() if k != "data/desk.db"}
    assert [r["email"] for r in env.desk.execute("SELECT email FROM subscribers")] == ["reader@example.com"]
    assert web.call("GET", "/admin/dashboard", cookie=web.cookie).status == 200      # still signed in
    assert "Undo the last import" in web.call("GET", "/admin/dashboard", cookie=web.cookie).text
    r = web.call("POST", "/admin/copy/undo", "", cookie=web.cookie)
    assert r.status == 303 and "m=" in r.headers["Location"]
    assert "late@example.com" in [r["email"] for r in env.desk.execute("SELECT email FROM subscribers")]


def test_the_desk_refuses_bad_uploads_and_strangers(web, env):
    assert web.call("POST", "/admin/copy/check", b"x" * 10, ctype="application/zip").status == 401
    assert web.call("GET", "/admin/copy/export").status == 303
    r = web.call("POST", "/admin/copy/check", b"not a zip at all", cookie=web.cookie, ctype="application/zip")
    assert r.status == 400 and "not a Bought copy" in json.loads(r.text)["error"]
    assert not list((env.tmp / "restore").glob(".upload-*"))
    r = web.call("POST", "/admin/copy/import", json.dumps({"id": "../../etc"}), cookie=web.cookie, ctype="application/json")
    assert r.status == 400


def test_no_import_while_a_job_runs(web, env):
    path = make(env)
    r = web.call("POST", "/admin/copy/check", path.read_bytes(), cookie=web.cookie, ctype="application/zip")
    token = json.loads(r.text)["id"]
    env.desk.execute("INSERT INTO jobs (kind, status, started_at) VALUES ('prepare','running','2026-11-11T06:00:00Z')")
    r = web.call("POST", "/admin/copy/import", json.dumps({"id": token}), cookie=web.cookie, ctype="application/json")
    assert r.status == 400 and "job is running" in json.loads(r.text)["error"]


def test_the_page_script_is_allowed_by_the_policy():
    assert server.sec.script_hash(server.dash_pages.COPY_JS) in server.DESK_CSP
