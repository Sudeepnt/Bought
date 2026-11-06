"""Email: subscribing (with a confirmation, so nobody can sign up someone else), the daily issue, and unsubscribing.

Sends over plain SMTP, so any mail service or your own server works. Set these before anything can go out:
  BOUGHT_SMTP_HOST, BOUGHT_SMTP_FROM   (e.g. "Bought. <issue@yourdomain.com>")
  BOUGHT_SMTP_PORT (default 587), BOUGHT_SMTP_USER, BOUGHT_SMTP_PASS
Without a host nothing is sent: people can still subscribe and wait as pending, and the admin page says so.
"""
from __future__ import annotations

import html
import os
import re
import secrets
import smtplib
import ssl
import time
from datetime import datetime, timezone
from email.message import EmailMessage
from email.utils import make_msgid

from .desk import stamp

EMAIL = re.compile(r"^[^@\s<>\"',;]{1,64}@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$")
SECTION_ORDER = ("AI", "Technology", "Business", "Founders", "Launches", "Geopolitics")


def smtp_config() -> dict:
    return {"host": os.environ.get("BOUGHT_SMTP_HOST", ""), "port": int(os.environ.get("BOUGHT_SMTP_PORT") or 587), "user": os.environ.get("BOUGHT_SMTP_USER", ""),
            "password": os.environ.get("BOUGHT_SMTP_PASS", ""), "from": os.environ.get("BOUGHT_SMTP_FROM", "")}


def can_send() -> bool:
    c = smtp_config()
    return bool(c["host"] and c["from"])


class Mailbox:
    """One SMTP connection, reopened once if the server drops it mid-batch."""

    def __init__(self, config=None):
        self.c = config or smtp_config()
        self.conn = None

    def _open(self):
        c = self.c
        if c["port"] == 465:
            s = smtplib.SMTP_SSL(c["host"], c["port"], timeout=30, context=ssl.create_default_context())
        else:
            s = smtplib.SMTP(c["host"], c["port"], timeout=30)
            s.ehlo()
            if s.has_extn("starttls"):
                s.starttls(context=ssl.create_default_context())
                s.ehlo()
            elif c["user"]:
                s.quit()
                raise RuntimeError("the mail server does not offer TLS, so the password was not sent")
        if c["user"]:
            s.login(c["user"], c["password"])
        return s

    def send(self, msg: EmailMessage) -> None:
        if msg["From"] is None:
            msg["From"] = self.c["from"]
        for attempt in (0, 1):
            try:
                self.conn = self.conn or self._open()
                self.conn.send_message(msg)
                return
            except (smtplib.SMTPServerDisconnected, ConnectionError, TimeoutError):
                self.conn = None
                if attempt:
                    raise

    def close(self):
        if self.conn:
            try:
                self.conn.quit()
            except Exception:
                pass
            self.conn = None


# ---------- subscribers ----------

def clean_email(value: str) -> str:
    email = (value or "").strip().lower()
    if len(email) > 254 or not EMAIL.match(email):
        raise ValueError("Enter a full email address, like you@company.com.")
    return email


def subscribe(desk, email: str, now: datetime) -> dict:
    """Add a pending subscriber. Someone already confirmed stays confirmed; someone who left has to confirm again."""
    email = clean_email(email)
    row = desk.execute("SELECT * FROM subscribers WHERE email=?", (email,)).fetchone()
    if row is None:
        desk.execute("INSERT INTO subscribers (email, status, token, created_at) VALUES (?,?,?,?)", (email, "pending", secrets.token_urlsafe(24), stamp(now)))
    elif row["status"] == "unsubscribed":
        desk.execute("UPDATE subscribers SET status='pending', confirm_sent_at=NULL WHERE email=?", (email,))
    return dict(desk.execute("SELECT * FROM subscribers WHERE email=?", (email,)).fetchone())


def confirm(desk, token: str, now: datetime) -> bool:
    return desk.execute("UPDATE subscribers SET status='confirmed', confirmed_at=? WHERE token=? AND status IN ('pending','confirmed')", (stamp(now), token)).rowcount > 0


def unsubscribe(desk, token: str, now: datetime) -> bool:
    return desk.execute("UPDATE subscribers SET status='unsubscribed', unsubscribed_at=? WHERE token=?", (stamp(now), token)).rowcount > 0


def _footer_text(address: str) -> str:
    return address or ""


def confirmation_message(to: str, token: str, site: str) -> EmailMessage:
    link = f"{site}/confirm?t={token}"
    msg = EmailMessage()
    msg["To"], msg["Subject"], msg["Message-ID"] = to, "Confirm your Bought. subscription", make_msgid()
    msg.set_content(f"Someone asked to send the daily Bought. issue to this address.\n\nConfirm here: {link}\n\nIf it wasn't you, ignore this email and nothing more will come.\n")
    msg.add_alternative(f'<p>Someone asked to send the daily <b>Bought.</b> issue to this address.</p><p><a href="{html.escape(link)}">Confirm my subscription</a></p><p style="color:#777">If it wasn\'t you, ignore this email and nothing more will come.</p>', subtype="html")
    return msg


def send_confirmations(desk, site: str, now: datetime, box=None, limit=200) -> int:
    """Send to anyone still waiting. Does nothing until mail and the site address are set."""
    if not site or not (box or can_send()):
        return 0
    rows = desk.execute("SELECT * FROM subscribers WHERE status='pending' AND confirm_sent_at IS NULL LIMIT ?", (limit,)).fetchall()
    mine = box or Mailbox()
    sent = 0
    try:
        for r in rows:
            mine.send(confirmation_message(r["email"], r["token"], site))
            desk.execute("UPDATE subscribers SET confirm_sent_at=? WHERE email=?", (stamp(now), r["email"]))
            sent += 1
    finally:
        if not box:
            mine.close()
    return sent


# ---------- the issue ----------

def issue_links(page: dict, site: str):
    """(story, link) grouped: the lead and top stories, then each section."""
    url = lambda s: f"{site}/#s-{page['issue']}-{s['uid']}"
    tops = [s for s in page["stories"] if s["sz"] in ("lead", "top")]
    groups = [(name, [s for s in page["stories"] if s["cat"] == name and s["sz"] not in ("lead", "top")]) for name in SECTION_ORDER]
    return [(s, url(s)) for s in tops], [(name, [(s, url(s)) for s in items]) for name, items in groups if items]


def issue_day(date: str) -> str:
    d = datetime.strptime(date, "%Y-%m-%d")
    return f"{d.strftime('%A')}, {d.day} {d.strftime('%B %Y')}"


def issue_message(page: dict, to: str, site: str, unsubscribe_url: str, address: str = "") -> EmailMessage:
    """The newspaper as an email: every headline links to its story. Feed text is escaped, and pictures are not embedded so the mail stays light."""
    e = html.escape
    tops, groups = issue_links(page, site)
    day = issue_day(page["issue"])
    lead = tops[0][0] if tops else page["stories"][0]
    msg = EmailMessage()
    msg["To"], msg["Message-ID"] = to, make_msgid()
    msg["Subject"] = f"Bought. {datetime.strptime(page['issue'], '%Y-%m-%d').strftime('%d %b')}: {lead['t']}"[:150]
    msg["List-Unsubscribe"] = f"<{unsubscribe_url}>"
    msg["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click"
    lines = [f"Bought. {day}", "", "TODAY"]
    lines += [f"- {s['t']}\n  {link}" for s, link in tops]
    for name, items in groups:
        lines += ["", name.upper()] + [f"- {s['t']}\n  {link}" for s, link in items]
    lines += ["", f"Read the whole issue: {site}/", "", f"Unsubscribe: {unsubscribe_url}"] + ([address] if address else [])
    msg.set_content("\n".join(lines) + "\n")
    row = lambda s, link, size: f'<p style="margin:0 0 4px;font:{size}px/1.3 Georgia,serif"><a href="{e(link)}" style="color:#1d1b18;text-decoration:none">{e(s["t"])}</a></p><p style="margin:0 0 16px;font:12px Arial,sans-serif;color:#8a8378">{e(s["src"][0])}</p>'
    body = "".join(row(s, link, 24 if n == 0 else 18) + (f'<p style="margin:-10px 0 18px;font:15px/1.5 Georgia,serif;color:#55504a">{e(s["dek"])}</p>' if n == 0 and s["dek"] else "") for n, (s, link) in enumerate(tops))
    for name, items in groups:
        body += f'<h2 style="margin:26px 0 12px;padding-top:12px;border-top:2px solid #1d1b18;font:bold 12px Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#1d1b18">{e(name)}</h2>' + "".join(row(s, link, 16) for s, link in items)
    msg.add_alternative(f'''<!doctype html><html><body style="margin:0;background:#f3eee4"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fbf8f1"><tr><td style="padding:28px 24px">
<p style="margin:0;font:bold 36px Georgia,serif;color:#1d1b18">Bought<span style="color:#b4432b">.</span></p><p style="margin:4px 0 22px;font:12px Arial,sans-serif;color:#8a8378">{e(day)}</p>
{body}
<p style="margin:24px 0"><a href="{e(site)}/" style="display:inline-block;padding:10px 18px;background:#1d1b18;color:#fbf8f1;text-decoration:none;font:bold 13px Arial,sans-serif;border-radius:4px">Read the whole issue</a></p>
<p style="margin:0;font:12px/1.6 Arial,sans-serif;color:#8a8378"><a href="{e(unsubscribe_url)}" style="color:#8a8378">Unsubscribe</a>{("<br>" + e(address)) if address else ""}</p>
</td></tr></table></td></tr></table></body></html>''', subtype="html")
    return msg


def send_issue(desk, page: dict, site: str, now: datetime, box=None, address: str = "", pause: float = 0.0) -> dict:
    """Send to every confirmed subscriber not yet sent this issue. Each send is logged, so rerunning after a crash never sends twice."""
    date = page["issue"]
    rows = desk.execute("SELECT s.* FROM subscribers s WHERE s.status='confirmed' AND s.email NOT IN (SELECT email FROM email_log WHERE issue=? AND status='sent')", (date,)).fetchall()
    mine = box or Mailbox()
    sent = failed = 0
    try:
        for r in rows:
            try:
                mine.send(issue_message(page, r["email"], site, f"{site}/unsubscribe?t={r['token']}", address))
                desk.execute("INSERT OR REPLACE INTO email_log VALUES (?,?,?,?,?)", (date, r["email"], "sent", None, stamp(now)))
                sent += 1
            except Exception as ex:                  # one bad address must not stop the rest
                desk.execute("INSERT OR REPLACE INTO email_log VALUES (?,?,?,?,?)", (date, r["email"], "failed", f"{type(ex).__name__}: {ex}"[:300], stamp(now)))
                failed += 1
            if pause:
                time.sleep(pause)
    finally:
        if not box:
            mine.close()
    return {"sent": sent, "failed": failed}


def now_utc() -> datetime:
    return datetime.now(timezone.utc)
