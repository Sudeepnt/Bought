"""One process for the VPS: the site, the admin page at /admin (password), subscribing, and the clock that publishes.

  python -m pipeline serve --port 8000

Password: BOUGHT_ADMIN_PASSWORD, or the file data/admin_password.txt, which is created with a random one on first start.
Listens on 127.0.0.1 only; put a TLS proxy (nginx, Caddy) in front of it on the VPS.
"""
from __future__ import annotations

import atexit
import email.utils
import gzip
import hashlib
import hmac
import http.client
import io
import json
import logging
import os
import re
import secrets
import shutil
import signal
import subprocess
import sys
import threading
import time
from datetime import datetime, timedelta, timezone
from functools import partial
from http.cookies import SimpleCookie
from http.server import ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from . import admin_pages as pages
from . import db, desk as dk, mailer
from . import security as sec
from .config import load_config, load_sources
from .funnel import publish as fp

ROOT = dk.ROOT
sys.path.insert(0, str(ROOT))
from serve_local import RangeHandler  # noqa: E402

log = logging.getLogger(__name__)
SESSION_HOURS = 12
BACKEND = ROOT / "backend"
BACKEND_PORT = int(os.environ.get("BOUGHT_BACKEND_PORT", "8787"))
PROXY_HEADERS = ("Content-Type", "Origin", "Authorization", "Mux-Signature", "Stripe-Signature", "X-Razorpay-Signature")
PROXY_MAX_BODY = 2 * 1024 * 1024
GZIP_TYPES = ("text/", "application/javascript", "application/json", "image/svg+xml", "application/wasm")
GZIP_CACHE_BYTES = 96 * 1024 * 1024
SITE_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "SAMEORIGIN",
    "Permissions-Policy": "camera=(self), microphone=(self), geolocation=(), payment=(self \"https://api.razorpay.com\"), interest-cohort=()",
    "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
}
DESK_CSP = sec.desk_csp([sec.script_hash(pages.REVIEW_JS)])
DESK_PORT = int(os.environ.get("BOUGHT_DESK_PORT", "8100"))


def cache_policy(path: str, query: str) -> str:
    """How long a browser may keep a file. HTML and JSON are always checked (a cheap 304 when unchanged), so a new
    issue shows at once; CSS and JS carry ?v= and the bundle's chunks a content hash, so they never need checking."""
    if re.search(r"(^|&)v=", query) or re.match(r"/(js/live/c-[\w-]+\.js|fonts/)", path):
        return "public, max-age=31536000, immutable"
    if path.startswith("/issues/") and not path.endswith(".json"):
        return "public, max-age=3600"          # an issue's pictures, videos and audio; a recut keeps the name, so not forever
    return "no-cache"


class GzipCache:
    """Compressed copies of text files, keyed by path, size and mtime, so each file is compressed once per change."""

    def __init__(self, limit: int = GZIP_CACHE_BYTES):
        self.limit, self.items, self.size, self.lock = limit, {}, 0, threading.Lock()

    def get(self, path: str, st) -> bytes:
        key = (path, st.st_size, st.st_mtime_ns)
        with self.lock:
            hit = self.items.pop(key, None)
            if hit is not None:
                self.items[key] = hit          # most recently used last
                return hit
        with open(path, "rb") as f:
            data = gzip.compress(f.read(), compresslevel=6, mtime=0)
        with self.lock:
            for old in [k for k in self.items if k[0] == path]:
                self.size -= len(self.items.pop(old))
            self.items[key] = data
            self.size += len(data)
            while self.size > self.limit and len(self.items) > 1:
                self.size -= len(self.items.pop(next(iter(self.items))))
        return data


GZ = GzipCache()


def read_secret(name: str, make) -> str:
    path = dk.data_dir() / name
    if path.exists():
        return path.read_text().strip()
    path.parent.mkdir(parents=True, exist_ok=True)
    value = make()
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w") as f:
        f.write(value + "\n")
    return value


class Throttle:
    """At most `limit` tries per key in `window` seconds."""

    def __init__(self, limit: int, window: float):
        self.limit, self.window, self.hits, self.lock = limit, window, {}, threading.Lock()

    def allow(self, key: str, now: float = None) -> bool:
        now = time.time() if now is None else now
        with self.lock:
            hits = [t for t in self.hits.get(key, []) if t > now - self.window]
            if len(hits) >= self.limit:
                self.hits[key] = hits
                return False
            self.hits[key] = hits + [now]
            return True


class App:
    """Everything the handler and the clock share. `runner` starts a funnel step; tests pass their own."""

    def __init__(self, config=None, sources=None, runner=None, box=None, clock=None):
        self.config_path, self.sources_path = config, sources or dk.PKG / "sources.live.yaml"
        self.runner = runner or self._spawn
        self.box = box
        self.clock = clock or (lambda: datetime.now(timezone.utc))
        self.password = os.environ.get("BOUGHT_ADMIN_PASSWORD") or read_secret("admin_password.txt", lambda: secrets.token_urlsafe(12))
        self.key = read_secret("admin_session_key", lambda: secrets.token_hex(32)).encode()
        self.logins = Throttle(5, 900)
        totp = os.environ.get("BOUGHT_ADMIN_TOTP", "").strip()
        self.codes = sec.CodeCheck(totp) if totp else None          # set on the server by deploy/setup.sh
        self._supabase = (0.0, None)
        self.signups = Throttle(5, 3600)
        self.job_lock = threading.Lock()
        self.process = None
        self.tick_lock = threading.Lock()
        self.fail_old_jobs()

    def cfg(self):
        return load_config(self.config_path)

    # ---------- the backend (backend/, Bought's Mux, Supabase and payments code) ----------
    def backend_secret(self) -> str:
        secret = os.environ.get("CRON_SECRET", "")
        path = BACKEND / ".env"
        if not secret and path.exists():
            for line in path.read_text().splitlines():
                if line.startswith("CRON_SECRET="):
                    secret = line.split("=", 1)[1].strip()
        return secret

    def start_backend(self):
        """Runs alongside the site so one command starts everything. No install, no backend: the page stays on its simulation."""
        if not (BACKEND / "node_modules").exists():
            log.warning("backend is not installed: run npm install in backend/")
            return None
        env = dict(os.environ, BOUGHT_BACKEND_PORT=str(BACKEND_PORT))
        env["BOUGHT_BACKEND_PARENT"] = "1"
        # the backend exits when this pipe closes, so however this process dies it can't leave one behind holding the port
        self.backend = subprocess.Popen(["node", "--env-file-if-exists=.env", "--import", "tsx", "server.ts"], cwd=BACKEND, env=env, stdin=subprocess.PIPE)
        return self.backend

    def backend_call(self, method: str, path: str, body: dict | None = None):
        """/admin talking to the backend. Returns (status, data); status 0 means it is not running."""
        headers = {"Authorization": f"Bearer {self.backend_secret()}"}
        payload = None
        if body is not None:
            payload, headers["Content-Type"] = json.dumps(body), "application/json"
        conn = http.client.HTTPConnection("127.0.0.1", BACKEND_PORT, timeout=30)
        try:
            conn.request(method, f"/api/bought/{path}", payload, headers)
            r = conn.getresponse()
            return r.status, json.loads(r.read() or b"{}")
        except (OSError, ValueError, http.client.HTTPException):
            return 0, {}
        finally:
            conn.close()

    def supabase_url(self):
        """For the site's CSP: the advertiser sign-in address, asked of the backend at most once a minute."""
        at, url = self._supabase
        if time.time() - at > 60:
            code, cfg = self.backend_call("GET", "config")
            url = cfg.get("supabaseUrl") if code == 200 else None
            self._supabase = (time.time(), url)
        return url

    def sources(self):
        return load_sources(self.sources_path)

    def news(self):
        return db.connect(dk.data_dir() / "news.db")

    def desk(self):
        return dk.connect()

    # ---------- sessions ----------
    def session(self, now=None) -> str:
        exp = int((now or time.time()) + SESSION_HOURS * 3600)
        return f"{exp}.{hmac.new(self.key, str(exp).encode(), hashlib.sha256).hexdigest()}"

    def valid(self, value: str, now=None) -> bool:
        try:
            exp, sig = (value or "").split(".")
            ok = hmac.compare_digest(sig, hmac.new(self.key, exp.encode(), hashlib.sha256).hexdigest())
            return ok and int(exp) > (now or time.time())
        except ValueError:
            return False

    def password_ok(self, value: str) -> bool:
        return hmac.compare_digest(hashlib.sha256((value or "").encode()).digest(), hashlib.sha256(self.password.encode()).digest())

    # ---------- jobs: funnel steps, one at a time, in their own process ----------
    def fail_old_jobs(self):
        """A job can't outlive the server's knowledge of it: after a restart it shows as stopped, with Retry on the page."""
        desk = self.desk()
        desk.execute("UPDATE jobs SET status='stopped', ended_at=? WHERE status='running'", (dk.stamp(self.clock()),))
        desk.execute("UPDATE issues SET state='failed', error='The server restarted during this step. Retry carries on where it stopped.' WHERE state='building'")

    def _spawn(self, kind: str, issue, log_path: Path):
        args = {"intake": ["intake"], "prepare": ["prepare", "--issue", issue], "languages": ["languages", "--issue", issue]}[kind]
        out = open(log_path, "ab")
        cmd = [sys.executable, "-m", "pipeline", "funnel", *args]
        if self.config_path:
            cmd += ["--config", str(self.config_path)]
        # readers come first: the job and everything it starts (ffmpeg, Chromium, the voice) get only the CPU and disk readers leave over
        if shutil.which("ionice"):
            cmd = ["ionice", "-c", "3", *cmd]
        return subprocess.Popen(cmd, cwd=ROOT, stdout=out, stderr=subprocess.STDOUT, preexec_fn=lambda: os.nice(19))

    def busy(self) -> bool:
        """The machine is busy serving (or already working) when the 1-minute load passes 70% of its cores."""
        try:
            return os.getloadavg()[0] > 0.7 * (os.cpu_count() or 1)
        except OSError:
            return False

    def may_start_background(self, settings) -> bool:
        """Work nobody clicked for waits for the reader hours after publishing and for a quiet machine."""
        return not dk.in_reader_hours(self.clock(), settings) and not self.busy()

    def running_job(self, desk):
        return desk.execute("SELECT * FROM jobs WHERE status='running' ORDER BY id DESC LIMIT 1").fetchone()

    def start_job(self, kind: str, issue=None) -> bool:
        with self.job_lock:
            desk = self.desk()
            if self.running_job(desk):
                return False
            folder = dk.data_dir() / "logs"
            folder.mkdir(parents=True, exist_ok=True)
            at = dk.stamp(self.clock())
            path = folder / f"{at.replace(':', '')}-{kind}.log"
            cur = desk.execute("INSERT INTO jobs (kind, issue, status, started_at, log) VALUES (?,?,?,?,?)", (kind, issue, "running", at, str(path)))
            self.process = (cur.lastrowid, kind, issue, self.runner(kind, issue, path))
            return True

    def check_job(self, desk):
        """Move an issue on when its job ends."""
        if not self.process:
            return
        job_id, kind, issue, proc = self.process
        code = proc.poll()
        if code is None:
            return
        self.process = None
        desk.execute("UPDATE jobs SET status=?, ended_at=?, exit_code=? WHERE id=?", ("done" if code == 0 else "failed", dk.stamp(self.clock()), code, job_id))
        if kind == "prepare":
            if code == 0:
                dk.set_issue(desk, issue, state="ready", ready_at=dk.stamp(self.clock()), error=None)
                dk.set_issue(desk, issue, languages="waiting")
            else:
                dk.set_issue(desk, issue, state="failed", error="Making the videos failed. See the log.")
        if kind == "languages":
            dk.set_issue(desk, issue, languages="done" if code == 0 else "failed")
            if code == 0 and dk.stage(desk, issue) == "live":
                self.put_live(desk, issue)                 # languages that finish after the issue went out join it now

    # ---------- going live ----------
    def put_live(self, desk, date: str) -> dict:
        settings = dk.get_settings(desk)
        return fp.publish(self.cfg(), date, self.news(), len(self.sources()), out_root=dk.out_dir(), public_root=dk.public_dir(), site=settings["site_url"] or None)

    def go_live(self, desk, date: str) -> None:
        try:
            self.put_live(desk, date)
        except Exception as e:
            log.exception("publish failed")
            dk.set_issue(desk, date, state="failed", error=f"Publishing failed: {type(e).__name__}: {e}"[:300])
            return
        dk.set_issue(desk, date, state="live", live_at=dk.stamp(self.clock()), go_now=0)
        self.write_label(desk)
        self.backend_call("POST", "admin/live", {"issue": date})  # the ads that won this issue go public with it
        self.send_emails(desk, date)

    def issue_page(self, date: str) -> dict:
        return json.loads((dk.public_dir() / "issues" / date / "issue.json").read_text())

    def send_emails(self, desk, date: str) -> dict:
        """Skips quietly, with the reason on the dashboard, until mail and the site address are set."""
        settings = dk.get_settings(desk)
        if not (self.box or mailer.can_send()) or not settings["site_url"]:
            return {"sent": 0, "failed": 0, "skipped": True}
        res = mailer.send_issue(desk, self.issue_page(date), settings["site_url"], self.clock(), box=self.box, address=settings["mail_address"])
        dk.set_issue(desk, date, emailed_at=dk.stamp(self.clock()))
        return res

    def write_label(self, desk) -> None:
        """The site shows the publish time; keep it in the file it already reads."""
        path = dk.public_dir() / "issues" / "index.json"
        if path.exists():
            data = json.loads(path.read_text())
            data["publish_label"] = dk.publish_label(dk.get_settings(desk))
            fp.write_json(path, data)

    # ---------- the clock ----------
    def tick(self) -> None:
        if not self.tick_lock.acquire(blocking=False):
            return
        try:
            desk = self.desk()
            self.check_job(desk)
            now = self.clock()
            settings = dk.get_settings(desk)
            for row in desk.execute("SELECT * FROM issues WHERE state='ready' ORDER BY date").fetchall():
                if row["go_now"] or (not row["held"] and now >= dk.due_at(row["date"], settings)):
                    self.go_live(desk, row["date"])
            # a job at a time: languages first, because a waiting issue should be complete when it goes out
            quiet = self.may_start_background(settings)
            if not self.running_job(desk):
                wait = desk.execute("SELECT date FROM issues WHERE languages='waiting' ORDER BY date LIMIT 1").fetchone()
                if wait and self.cfg().translate_languages and not quiet:
                    pass                                    # translating waits for the readers; the issue is already out in English
                elif wait and self.cfg().translate_languages:
                    dk.set_issue(desk, wait["date"], languages="running")
                    self.start_job("languages", wait["date"])
                elif wait:
                    dk.set_issue(desk, wait["date"], languages="none")
            every = int(settings["auto_fetch_minutes"])
            if every and quiet and not self.running_job(desk):
                last = desk.execute("SELECT MAX(started_at) m FROM jobs WHERE kind='intake'").fetchone()["m"]
                if not last or now - datetime.strptime(last, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc) >= timedelta(minutes=every):
                    self.start_job("intake")
            if settings["site_url"] and (self.box or mailer.can_send()):
                try:
                    mailer.send_confirmations(desk, settings["site_url"], now, box=self.box)
                except Exception as e:
                    log.warning("confirmation emails failed: %s", str(e)[:200])
        finally:
            self.tick_lock.release()


class Handler(RangeHandler):
    """The desk: the site plus admin. Listens only inside the server (see serve); PublicHandler is what the internet gets."""
    app: App = None
    desk = True
    timeout = 60                    # a client that stops sending mid-request can't hold a thread forever

    def version_string(self) -> str:
        return "Bought"             # no software or version names for anyone to look up
    _static = False
    _ctype = ""
    _inline = ()

    def send_header(self, keyword, value):
        if keyword.lower() == "content-type":
            self._ctype = value
        super().send_header(keyword, value)

    def _host_ok(self) -> bool:
        """The desk answers only to its own names: a site that points its domain at this machine (DNS rebinding) is refused."""
        if not self.desk:
            return True
        return (self.headers.get("Host") or "").strip().lower() in sec.desk_hosts(self.server.server_address[1])

    # ---------- the site's files ----------
    def cache_control(self) -> str:
        if not self._static:
            return "no-store"
        url = urlparse(self.path)
        return cache_policy(url.path, url.query)

    def end_headers(self):
        if self._static:
            for k, v in SITE_HEADERS.items():
                self.send_header(k, v)
            if self._ctype.startswith("text/html"):
                https = self.headers.get("X-Forwarded-Proto") == "https"
                self.send_header("Content-Security-Policy", sec.site_csp(self.app.supabase_url() if self.app else None, https, self._inline))
        super().end_headers()

    def list_directory(self, path):
        self.send_error(404, "File not found")       # never list a folder of the site
        return None

    def send_head(self):
        """Text files go out gzipped when the browser accepts it; everything else (ranges, video) as before."""
        html = self.translate_path(self.path)
        html = os.path.join(html, "index.html") if os.path.isdir(html) else html
        if html.endswith(".html") and os.path.isfile(html) and os.path.getsize(html) < 1_000_000:
            with open(html, encoding="utf-8", errors="replace") as f:
                self._inline = sec.allowed_inline(f.read())
        if self.headers.get("Range") or "gzip" not in (self.headers.get("Accept-Encoding") or ""):
            return super().send_head()
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            if not urlparse(self.path).path.endswith("/"):
                return super().send_head()           # its redirect to the slash
            path = os.path.join(path, "index.html")
        ctype = self.guess_type(path)
        if not ctype.startswith(GZIP_TYPES) or not os.path.isfile(path):
            return super().send_head()
        st = os.stat(path)
        if st.st_size < 1024:
            return super().send_head()
        etag = f'W/"{st.st_mtime_ns:x}-{st.st_size:x}"'
        if self._not_modified(etag, st):
            self.send_response(304)
            self.send_header("ETag", etag)
            self.send_header("Vary", "Accept-Encoding")
            self.end_headers()
            return None
        body = GZ.get(path, st)
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Encoding", "gzip")
        self.send_header("Vary", "Accept-Encoding")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Last-Modified", self.date_time_string(int(st.st_mtime)))
        self.send_header("ETag", etag)
        self.end_headers()
        return io.BytesIO(body)

    def _not_modified(self, etag: str, st) -> bool:
        match = self.headers.get("If-None-Match")
        if match:
            return etag in [m.strip() for m in match.split(",")] or match.strip() == "*"
        since = self.headers.get("If-Modified-Since")
        if since:
            try:
                return int(st.st_mtime) <= email.utils.parsedate_to_datetime(since).timestamp()
            except (TypeError, ValueError, IndexError, OverflowError):
                return False
        return False

    def do_HEAD(self):
        if not self._host_ok():
            return self._send("", 421, "text/plain")
        url = urlparse(self.path)
        if url.path.startswith(("/api/", "/admin")) or url.path in ("/confirm", "/unsubscribe", "/healthz"):
            return self._send("", 405, "text/plain")
        self._static = True
        return super().do_HEAD()

    def _cookie(self, name):
        raw = self.headers.get("Cookie")
        if not raw:
            return None
        morsel = SimpleCookie(raw).get(name)
        return morsel.value if morsel else None

    def _ip(self) -> str:
        # the proxy on the VPS sets this; straight connections only ever come from this machine
        return (self.headers.get("X-Real-IP") or self.client_address[0]).strip()

    def _send(self, body: str, code=200, ctype="text/html; charset=utf-8", cookies=()):
        data = body.encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("X-Robots-Tag", "noindex")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "same-origin")   # browsers send Origin only with this; outside links stay private
        self.send_header("X-Content-Type-Options", "nosniff")
        if ctype.startswith("text/html"):
            self.send_header("Content-Security-Policy", DESK_CSP)
        for c in cookies:
            self.send_header("Set-Cookie", c)
        self.end_headers()
        self.wfile.write(data)

    def _json(self, data, code=200):
        self._send(json.dumps(data), code, "application/json")

    def _redirect(self, to: str, cookies=()):
        self.send_response(303)
        self.send_header("Location", to)
        for c in cookies:
            self.send_header("Set-Cookie", c)
        self.end_headers()

    def _body(self, limit=65536) -> bytes:
        n = int(self.headers.get("Content-Length") or 0)
        return self.rfile.read(min(n, limit)) if n else b""

    def _form(self) -> dict:
        body = self._body()
        if (self.headers.get("Content-Type") or "").startswith("application/json"):
            try:
                data = json.loads(body or b"{}")
                return data if isinstance(data, dict) else {}
            except ValueError:
                return {}
        return {k: v[0] for k, v in parse_qs(body.decode(errors="replace")).items()}

    def _same_origin(self) -> bool:
        origin = self.headers.get("Origin") or self.headers.get("Referer")
        if not origin:
            return False
        host = self.headers.get("Host") if self.desk else (self.headers.get("X-Forwarded-Host") or self.headers.get("Host"))
        return urlparse(origin).netloc == host

    def _signed_in(self) -> bool:
        return self.app.valid(self._cookie("bought_admin"))

    def _session_cookie(self, value: str, age: int) -> str:
        secure = "; Secure" if self.headers.get("X-Forwarded-Proto") == "https" else ""
        return f"bought_admin={value}; Path=/admin; Max-Age={age}; HttpOnly; SameSite=Strict{secure}"

    # ---------- GET ----------
    def do_GET(self):
        if not self._host_ok():
            return self._send("Misdirected request", 421, "text/plain")
        url = urlparse(self.path)
        q = {k: v[0] for k, v in parse_qs(url.query).items()}
        if url.path.startswith("/api/bought/"):
            return self._proxy()
        if url.path in ("/confirm", "/unsubscribe"):
            return self._send(pages.mail_page(url.path[1:], q.get("t", "")))
        if url.path == "/healthz":
            if not self.desk:
                return self._json({"ok": True})                         # the public learns only that the site is up
            code, cfg = self.app.backend_call("GET", "config")
            return self._json({"ok": True, "ads": "down" if code != 200 else "live" if cfg.get("live") else "simulated"})
        if not self.desk or not (url.path == "/admin" or url.path.startswith("/admin/")):
            self._static = True
            return super().do_GET()
        if url.path == "/admin/login":
            return self._send(pages.login(code=bool(self.app.codes)))
        if not self._signed_in():
            return self._redirect("/admin/login")
        return self._admin_get(url.path, q)

    def _date(self, q, desk) -> str:
        d = q.get("date") or dk.working_date(desk, self.app.clock())
        datetime.strptime(d, "%Y-%m-%d")
        return d

    def _admin_get(self, path, q):
        app, desk = self.app, self.app.desk()
        try:
            date = self._date(q, desk)
        except ValueError:
            return self._send("Bad date", 400, "text/plain")
        now = app.clock()
        news = app.news()
        s = dk.get_settings(desk)
        common = dict(date=date, stage=dk.stage(desk, date), settings=s, row=dk.issue_row(desk, date), job=app.running_job(desk), now=now, message=q.get("m", ""), error=q.get("e", ""))
        if path in ("/admin", "/admin/"):
            names = [x.name for x in app.sources()]
            jobs = desk.execute("SELECT * FROM jobs ORDER BY id DESC LIMIT 12").fetchall()
            issues = desk.execute("SELECT * FROM issues ORDER BY date DESC LIMIT 10").fetchall()
            return self._send(pages.dashboard(data=dk.overview(news, desk, date, now, names), jobs=jobs, issues=issues, mail_ready=mailer.can_send(), **common))
        if path == "/admin/review":
            if common["stage"] != "review":
                return self._redirect(f"/admin/final?date={date}")
            return self._send(pages.review(board=dk.board(news, desk, date), **common))
        if path == "/admin/final":
            return self._send(pages.final(stories=dk.final_stories(news, desk, date), due=dk.due_at(date, s), **common))
        if path == "/admin/email":
            subs = desk.execute("SELECT * FROM subscribers ORDER BY created_at DESC LIMIT 500").fetchall()
            sends = desk.execute("SELECT issue, SUM(status='sent') sent, SUM(status='failed') failed FROM email_log GROUP BY issue ORDER BY issue DESC LIMIT 14").fetchall()
            failures = desk.execute("SELECT * FROM email_log WHERE status='failed' ORDER BY at DESC LIMIT 20").fetchall()
            latest = (dk.public_dir() / "issues" / "index.json")
            return self._send(pages.email(subs=subs, sends=sends, failures=failures, mail_ready=mailer.can_send(), has_issue=latest.exists(), **common))
        if path == "/admin/email/preview":
            return self._preview(desk, s)
        if path == "/admin/settings":
            return self._send(pages.settings_page(**common))
        if path == "/admin/ads":
            code, status = app.backend_call("GET", "admin/status")
            data = app.backend_call("GET", "admin/money")[1] if code == 200 and status.get("live") else {}
            return self._send(pages.ads_page(running=code != 0, status=status, data=data, **common))
        if path == "/admin/log":
            return self._log_page(desk, q, common)
        return self._send("Not found", 404, "text/plain")

    def _preview(self, desk, s):
        index = dk.public_dir() / "issues" / "index.json"
        if not index.exists():
            return self._send("No published issue to preview yet.", 404, "text/plain")
        page = self.app.issue_page(json.loads(index.read_text())["latest"])
        msg = mailer.issue_message(page, "reader@example.com", s["site_url"] or "https://your-site.example", "#unsubscribe", s["mail_address"])
        return self._send(msg.get_body(preferencelist=("html",)).get_content())

    def _log_page(self, desk, q, common):
        row = desk.execute("SELECT * FROM jobs WHERE id=?", (q.get("job", "0"),)).fetchone()
        text = ""
        if row and row["log"] and Path(row["log"]).exists():
            text = Path(row["log"]).read_text(errors="replace")[-20000:]
        return self._send(pages.log_page(job=row, text=text, **common))

    # ---------- POST ----------
    def do_POST(self):
        if not self._host_ok():
            self._body()
            return self._send("Misdirected request", 421, "text/plain")
        url = urlparse(self.path)
        q = {k: v[0] for k, v in parse_qs(url.query).items()}
        if url.path == "/api/subscribe":
            return self._subscribe()
        if url.path.startswith("/api/bought/"):
            return self._proxy()
        if url.path in ("/confirm", "/unsubscribe"):
            return self._mail_action(url.path[1:], q)
        if not self.desk:
            self._body()
            return self._send("Not found", 404, "text/plain")
        if url.path == "/admin/login":
            return self._login()
        if not url.path.startswith("/admin/"):
            return self._send("Not found", 404, "text/plain")
        if not self._signed_in():
            return self._json({"error": "sign in"}, 401)
        if not self._same_origin():
            return self._json({"error": "refused"}, 403)
        return self._admin_post(url.path)

    def _proxy(self):
        """Readers and providers reach the backend through this one address. /admin/* on it stays private."""
        path = urlparse(self.path).path
        if path.startswith(("/api/bought/admin", "/api/bought/cron")):
            self._body()
            return self._json({"error": "Not found."}, 404)
        size = int(self.headers.get("Content-Length") or 0)
        if size > PROXY_MAX_BODY:
            return self._json({"error": "Request is too large."}, 413)
        body = self.rfile.read(size) if size else None
        headers = {h: self.headers[h] for h in PROXY_HEADERS if self.headers.get(h)}
        headers["X-Forwarded-For"] = self._ip()
        conn = http.client.HTTPConnection("127.0.0.1", BACKEND_PORT, timeout=120)
        try:
            conn.request(self.command, self.path, body, headers)
            r = conn.getresponse()
            data = r.read()
            self.send_response(r.status)
            for k, v in r.getheaders():
                if k.lower() not in ("transfer-encoding", "connection", "date", "keep-alive", "content-length"):
                    self.send_header(k, v)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        except (OSError, http.client.HTTPException):
            if path == "/api/bought/config":
                return self._json({"live": False})
            return self._json({"error": "Advertising is not connected yet."}, 503)
        finally:
            conn.close()

    def _subscribe(self):
        app = self.app
        form = self._form()
        if self.headers.get("Origin") and not self._same_origin():
            return self._json({"error": "refused"}, 403)
        if not app.signups.allow(self._ip()):
            return self._json({"error": "Too many tries. Please try again later."}, 429)
        try:
            mailer.subscribe(app.desk(), form.get("email", ""), app.clock())
        except ValueError as e:
            return self._json({"error": str(e)}, 400)
        desk = app.desk()
        ready = bool(app.box or mailer.can_send()) and bool(dk.get_settings(desk)["site_url"])
        # the answer is the same for a new and a known address, so the form can't be used to check who subscribes
        return self._json({"ok": True, "message": "Almost done: check your inbox to confirm." if ready else "You're on the list. We'll email you a link to confirm."})

    def _mail_action(self, action, q):
        token = q.get("t", "")
        self._body()
        desk, now = self.app.desk(), self.app.clock()
        done = (mailer.confirm if action == "confirm" else mailer.unsubscribe)(desk, token, now)
        return self._send(pages.mail_done(action, done))

    def _login(self):
        form, codes = self._form(), self.app.codes
        if not self.app.logins.allow(self._ip()):
            return self._send(pages.login("Too many tries. Wait 15 minutes.", code=bool(codes)), 429)
        if not self._same_origin():
            return self._send(pages.login("Open the desk again and sign in from there.", code=bool(codes)), 403)
        password_ok = self.app.password_ok(form.get("password", ""))
        code_ok = codes is None or codes.verify(form.get("code", ""))     # both are checked, so a reply can't tell which one was wrong
        if not (password_ok and code_ok):
            return self._send(pages.login("That password or code is not right." if codes else "That password is not right.", code=bool(codes)), 401)
        return self._redirect("/admin", [self._session_cookie(self.app.session(), SESSION_HOURS * 3600)])

    def _admin_post(self, path):
        app, form = self.app, self._form()
        desk, news, now = app.desk(), app.news(), app.clock()
        date = form.get("date") or dk.working_date(desk, now)
        back = lambda page, **kw: self._redirect(f"/admin{page}?date={date}" + "".join(f"&{k}={pages.quote(v)}" for k, v in kw.items()))
        try:
            datetime.strptime(date, "%Y-%m-%d")
            if path == "/admin/api/decide":
                dk.decide(news, desk, form.get("id", ""), form.get("action", ""), date, now)
                return self._json({"ok": True})
            if path == "/admin/logout":
                return self._redirect("/admin/login", [self._session_cookie("", 0)])
            if path == "/admin/fetch":
                started = app.start_job("intake")
                return back("", m="Fetching the sources." if started else "Another job is running. Try again when it finishes.")
            if path == "/admin/finalize":
                dk.finalize(news, desk, date, now)
                return back("/final")
            if path == "/admin/reopen":
                dk.back_to_review(news, desk, date)
                return back("/review")
            if path == "/admin/publish":
                if app.running_job(desk):
                    return back("/final", e="Another job is running. Try again when it finishes.")
                dk.click_publish(news, desk, date, now)
                app.start_job("prepare", date)
                return back("/final", m="In the publish stage: making the videos and audio.")
            if path == "/admin/hold":
                dk.set_issue(desk, date, held=int(form.get("held", "1")))
                return back("/final")
            if path == "/admin/publish-now":
                if dk.stage(desk, date) != "ready":
                    return back("/final", e="The issue is not ready yet.")
                dk.set_issue(desk, date, go_now=1, held=0)      # the clock does it: copying the issue takes longer than a click should wait
                return back("/final")
            if path == "/admin/ads/withdrawal":
                code, res = app.backend_call("POST", "admin/withdrawal", {"id": form.get("id", "")})
                return self._redirect("/admin/ads?" + (f"m={pages.quote('Marked as paid.')}" if code == 200 else f"e={pages.quote(res.get('error') or 'That did not save. Try again.')}"))
            if path == "/admin/settings":
                dk.save_settings(desk, form)
                app.write_label(desk)
                return back("/settings", m="Saved.")
            if path == "/admin/email/test":
                to = mailer.clean_email(form.get("to", ""))
                index = dk.public_dir() / "issues" / "index.json"
                s = dk.get_settings(desk)
                box = app.box or mailer.Mailbox()
                msg = mailer.issue_message(app.issue_page(json.loads(index.read_text())["latest"]), to, s["site_url"] or "https://your-site.example", "#test", s["mail_address"])
                box.send(msg)
                if not app.box:
                    box.close()
                return back("/email", m=f"Test sent to {to}.")
            if path == "/admin/email/retry":
                res = app.send_emails(desk, date)
                return back("/email", m="Mail or the site address is not set yet." if res.get("skipped") else f"Sent {res['sent']}, failed {res['failed']}.")
            if path == "/admin/retry":
                if app.running_job(desk):
                    return back("/final", e="Another job is running. Try again when it finishes.")
                dk.click_publish(news, desk, date, now)
                app.start_job("prepare", date)
                return back("/final", m="Trying again. Finished videos are kept.")
        except (ValueError, PermissionError, KeyError, OSError) as e:
            if path == "/admin/api/decide":
                return self._json({"error": str(e)}, 400)
            target = {"/admin/settings": "/settings", "/admin/email/test": "/email", "/admin/email/retry": "/email"}.get(path, "/final")
            return back(target, e=str(e))
        return self._send("Not found", 404, "text/plain")


class Server(ThreadingHTTPServer):
    """The standard library waits with 5 connections queued and refuses the rest: a page opens dozens at once, and
    06:00 UTC brings everyone together."""
    request_queue_size = 1024
    daemon_threads = True


class PublicHandler(Handler):
    """What the internet reaches (through Caddy): the site, subscribing, mail links, the ads API and its webhooks.
    There is no admin here at all: every admin path is just a missing file."""
    desk = False


def serve(host: str, port: int, config=None, sources=None, desk_host: str = "127.0.0.1", desk_port: int = DESK_PORT) -> int:
    app = App(config=config, sources=sources)
    backend = app.start_backend()
    if backend:
        atexit.register(backend.terminate)
    Handler.app = app
    server = Server((host, port), partial(PublicHandler, directory=str(dk.public_dir())))
    desk = Server((desk_host, desk_port), partial(Handler, directory=str(dk.public_dir())))
    threading.Thread(target=desk.serve_forever, daemon=True).start()

    def clock():
        while True:
            try:
                app.tick()
            except Exception:
                log.exception("clock tick failed")
            time.sleep(15)
    threading.Thread(target=clock, daemon=True).start()
    # systemd stops the service with SIGTERM: leave through sys.exit so atexit stops the backend too
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))
    print(f"Site:  http://{host}:{port}/\nDesk:  http://{desk_host}:{desk_port}/admin  (private: reach it through an SSH tunnel or Tailscale, never the public address)", flush=True)
    if not app.codes:
        print("Desk sign-in is password only: set BOUGHT_ADMIN_TOTP for a code from an authenticator app (deploy/setup.sh does).", flush=True)
    if not os.environ.get("BOUGHT_ADMIN_PASSWORD"):
        print(f"Admin password is in {dk.data_dir() / 'admin_password.txt'}", flush=True)
    server.serve_forever()
    return 0
