"""Cloudflare R2: where the site's heavy files live (the issue's videos, posters and podcast).

R2 speaks the S3 API. This is the small part of it Bought needs, signed with AWS Signature V4 using only the standard
library: put, head, delete and list objects. Readers never talk to this API; they read the files from R2_PUBLIC_URL.

Settings (environment, or backend/.env on a laptop):
  R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL
Without them the site serves the files itself from public/issues/, as before.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import hmac
import mimetypes
import os
import re
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

KEYS = ("R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_PUBLIC_URL")
ROOT = Path(__file__).resolve().parents[1]
LOCAL_ENV = ROOT / "backend" / ".env"
TYPES = {".mp4": "video/mp4", ".webm": "video/webm", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
         ".webp": "image/webp", ".mp3": "audio/mpeg", ".json": "application/json", ".vtt": "text/vtt"}


class R2Error(RuntimeError):
    pass


def load_local_env(path: Path = LOCAL_ENV) -> None:
    """On a laptop the keys sit in backend/.env (git ignores it). Values already in the environment win; on the VPS
    systemd sets everything from /etc/bought/bought.env and this file does not exist."""
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$", line)
        if m and m[2] and not os.environ.get(m[1]):
            os.environ[m[1]] = m[2].strip("'\"")


def configured() -> bool:
    return all(os.environ.get(k, "").strip() for k in KEYS)


def store():
    """The R2 client when R2 is configured, else None (the site keeps serving its own files)."""
    return R2() if configured() else None


def public_url(key: str) -> str:
    return f"{os.environ['R2_PUBLIC_URL'].strip().rstrip('/')}/{urllib.parse.quote(key)}"


def _sign(key: bytes, msg: str) -> bytes:
    return hmac.new(key, msg.encode(), hashlib.sha256).digest()


def sign_headers(method: str, path: str, qs: str, headers: dict, payload_hash: str, access_key: str, secret_key: str,
                 region: str, now: dt.datetime) -> dict:
    """AWS Signature V4 in the Authorization header. headers must include host; returns them with the signature added.
    Tested against AWS's published GET Object example."""
    amz_date, day = now.strftime("%Y%m%dT%H%M%SZ"), now.strftime("%Y%m%d")
    hdrs = {**{k.lower(): v for k, v in headers.items()}, "x-amz-content-sha256": payload_hash, "x-amz-date": amz_date}
    names = sorted(hdrs)
    canonical = "\n".join([method, path, qs, "".join(f"{n}:{str(hdrs[n]).strip()}\n" for n in names), ";".join(names), payload_hash])
    scope = f"{day}/{region}/s3/aws4_request"
    to_sign = "\n".join(["AWS4-HMAC-SHA256", amz_date, scope, hashlib.sha256(canonical.encode()).hexdigest()])
    k = _sign(_sign(_sign(_sign(("AWS4" + secret_key).encode(), day), region), "s3"), "aws4_request")
    signature = hmac.new(k, to_sign.encode(), hashlib.sha256).hexdigest()
    hdrs["authorization"] = f"AWS4-HMAC-SHA256 Credential={access_key}/{scope}, SignedHeaders={';'.join(names)}, Signature={signature}"
    return hdrs


class R2:
    def __init__(self, account=None, access_key=None, secret_key=None, bucket=None, timeout=60):
        env = os.environ.get
        self.account = (account or env("R2_ACCOUNT_ID", "")).strip()
        self.access_key = (access_key or env("R2_ACCESS_KEY_ID", "")).strip()
        self.secret_key = (secret_key or env("R2_SECRET_ACCESS_KEY", "")).strip()
        self.bucket = (bucket or env("R2_BUCKET", "")).strip()
        if not (self.account and self.access_key and self.secret_key and self.bucket):
            raise R2Error("R2 is not configured: set " + ", ".join(KEYS))
        self.host = f"{self.account}.r2.cloudflarestorage.com"
        self.timeout = timeout

    def _request(self, method: str, key: str = "", body: bytes | Path = b"", headers=None, query=None):
        path = "/" + self.bucket + ("/" + urllib.parse.quote(key, safe="/~") if key else "")
        query = sorted((query or {}).items())
        qs = "&".join(f"{urllib.parse.quote(k, safe='~')}={urllib.parse.quote(str(v), safe='~')}" for k, v in query)
        if isinstance(body, Path):
            digest = hashlib.sha256()
            with body.open("rb") as f:
                for chunk in iter(lambda: f.read(1 << 20), b""):
                    digest.update(chunk)
            payload_hash, size = digest.hexdigest(), body.stat().st_size
        else:
            payload_hash, size = hashlib.sha256(body).hexdigest(), len(body)
        hdrs = {"host": self.host, **{k.lower(): str(v) for k, v in (headers or {}).items()}}
        if method in ("PUT", "POST"):
            hdrs["content-length"] = str(size)
        hdrs = sign_headers(method, path, qs, hdrs, payload_hash, self.access_key, self.secret_key, "auto", dt.datetime.now(dt.timezone.utc))
        del hdrs["host"]
        data = body.open("rb") if isinstance(body, Path) else (body if method in ("PUT", "POST") else None)
        req = urllib.request.Request(f"https://{self.host}{path}" + (f"?{qs}" if qs else ""), data=data, method=method, headers=hdrs)
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                return resp.status, dict(resp.headers), resp.read()
        except urllib.error.HTTPError as e:
            if e.code == 404 and method in ("HEAD", "DELETE"):
                return 404, dict(e.headers), b""
            raise R2Error(f"R2 {method} {key or self.bucket} failed: HTTP {e.code} {e.read()[:300].decode('utf-8', 'replace')}") from None
        except urllib.error.URLError as e:
            raise R2Error(f"R2 {method} {key or self.bucket} failed: {e.reason}") from None
        finally:
            if isinstance(body, Path) and data is not None:
                data.close()

    def put_file(self, key: str, path: Path, cache_control: str = "public, max-age=31536000, immutable", content_type=None) -> None:
        ctype = content_type or TYPES.get(path.suffix.lower()) or mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        self._request("PUT", key, Path(path), {"content-type": ctype, "cache-control": cache_control})

    def head(self, key: str) -> dict | None:
        status, headers, _ = self._request("HEAD", key)
        if status == 404:
            return None
        return {"size": int(headers.get("Content-Length") or 0), "type": headers.get("Content-Type", ""), "etag": headers.get("ETag", "")}

    def delete(self, key: str) -> None:
        self._request("DELETE", key)

    def list(self, prefix: str = "") -> list[dict]:
        found, token = [], None
        while True:
            query = {"list-type": "2", "prefix": prefix, **({"continuation-token": token} if token else {})}
            _, _, raw = self._request("GET", query=query)
            root = ET.fromstring(raw)
            ns = {"s": root.tag.split("}")[0].strip("{")} if root.tag.startswith("{") else {}
            find = (lambda el, tag: el.find(f"s:{tag}", ns)) if ns else (lambda el, tag: el.find(tag))
            for item in root.findall("s:Contents", ns) if ns else root.findall("Contents"):
                found.append({"key": find(item, "Key").text, "size": int(find(item, "Size").text)})
            truncated = find(root, "IsTruncated")
            token_el = find(root, "NextContinuationToken")
            if truncated is None or truncated.text != "true" or token_el is None:
                return found
            token = token_el.text
