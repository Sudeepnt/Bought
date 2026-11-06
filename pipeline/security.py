"""The rules that keep the site and the desk safe: the browser's Content Security Policy, the desk's one-time codes, and
the check that a request for the desk really is for the desk.

The desk (admin) is never on the public address. It listens on its own port inside the server; people reach it through
an SSH tunnel or a private network (Tailscale), then sign in with the password and a code from an authenticator app.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import os
import re
import secrets
import struct
import threading
import time

# ---------- Content Security Policy ----------
# The site runs only its own scripts. Outside it talks to: Supabase (advertiser sign-in, pictures), Mux (ad video, uploads
# go straight to Google Cloud Storage), Razorpay (UPI checkout window). Stripe is a full-page redirect, which CSP leaves alone.
SHARE_REDIRECT = re.compile(r'^location\.replace\("[^"<>\\]*"\);$')
INLINE_SCRIPT = re.compile(r"<script>(.*?)</script>", re.S)


def script_hash(source: str) -> str:
    return "'sha256-" + base64.b64encode(hashlib.sha256(source.encode()).digest()).decode() + "'"


def allowed_inline(html: str) -> list[str]:
    """Inline scripts in a page we wrote: only the share pages' one-line redirect is allowed, by its exact hash.
    Anything else that ever found its way into a page would be refused by the browser."""
    return [script_hash(s) for s in INLINE_SCRIPT.findall(html) if SHARE_REDIRECT.match(s)]


def site_csp(supabase_url: str | None, https: bool, inline=()) -> str:
    sb = []
    if supabase_url and re.fullmatch(r"https://[A-Za-z0-9.-]+(:\d+)?", supabase_url.rstrip("/")):
        sb = [supabase_url.rstrip("/"), "wss://" + supabase_url.rstrip("/")[8:]]
    rules = {
        "default-src": ["'self'"],
        "script-src": ["'self'", "https://checkout.razorpay.com", *inline],
        "style-src": ["'self'", "'unsafe-inline'"],             # the page sets colours in style attributes; no script can run from CSS
        "img-src": ["'self'", "data:", "blob:", *sb[:1], "https://image.mux.com"],
        "media-src": ["'self'", "blob:", "https://stream.mux.com"],
        "font-src": ["'self'"],
        "connect-src": ["'self'", *sb, "https://stream.mux.com", "https://storage.googleapis.com",
                        "https://api.razorpay.com", "https://lumberjack.razorpay.com"],
        "worker-src": ["'self'", "blob:"],
        "frame-src": ["https://api.razorpay.com", "https://checkout.razorpay.com"],
        "object-src": ["'none'"],
        "base-uri": ["'self'"],
        "form-action": ["'self'"],
        "frame-ancestors": ["'self'"],
    }
    parts = [f"{k} {' '.join(v)}" for k, v in rules.items()]
    if https:
        parts.append("upgrade-insecure-requests")
    return "; ".join(parts)


def desk_csp(inline=()) -> str:
    return "; ".join([
        "default-src 'self'",
        "script-src 'self' " + " ".join(inline),
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "media-src 'self'",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'self'",
        "frame-ancestors 'none'",
    ])


# ---------- one-time codes (RFC 6238, what Google Authenticator, 1Password and Authy use) ----------
STEP = 30


def new_totp_secret() -> str:
    return base64.b32encode(secrets.token_bytes(20)).decode().rstrip("=")


def totp(secret: str, counter: int) -> str:
    key = base64.b32decode(secret.upper() + "=" * (-len(secret) % 8))
    digest = hmac.new(key, struct.pack(">Q", counter), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    return f"{(struct.unpack('>I', digest[offset:offset + 4])[0] & 0x7FFFFFFF) % 1_000_000:06d}"


def otpauth_uri(secret: str, account: str = "desk") -> str:
    return f"otpauth://totp/Bought:{account}?secret={secret}&issuer=Bought&digits=6&period={STEP}"


class CodeCheck:
    """Accepts the code for now or 30 seconds either side (clock drift), and each code only once."""

    def __init__(self, secret: str):
        self.secret, self.last, self.lock = secret, -1, threading.Lock()

    def verify(self, code: str, now: float = None) -> bool:
        code = re.sub(r"\s", "", code or "")
        if not re.fullmatch(r"\d{6}", code):
            return False
        now_step = int((time.time() if now is None else now) // STEP)
        with self.lock:
            for counter in (now_step - 1, now_step, now_step + 1):
                if counter > self.last and hmac.compare_digest(totp(self.secret, counter), code):
                    self.last = counter                    # a code seen once can't be replayed
                    return True
        return False


# ---------- which Host the desk answers to ----------
def desk_hosts(port: int, extra: str = None) -> set[str]:
    """localhost names on the desk's port, plus BOUGHT_DESK_HOSTNAMES (e.g. the server's Tailscale name). A web page that
    points its own domain at 127.0.0.1 (DNS rebinding) sends its own name as Host, so it is refused."""
    hosts = {f"localhost:{port}", f"127.0.0.1:{port}", f"[::1]:{port}"}
    for name in (extra if extra is not None else os.environ.get("BOUGHT_DESK_HOSTNAMES", "")).split(","):
        name = name.strip().lower()
        if name:
            hosts |= {name} if ":" in name else {name, f"{name}:{port}"}
    return hosts
