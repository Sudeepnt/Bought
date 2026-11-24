"""Portraits of well-known people, reused across videos: line art traced from photos we are allowed to use.

  python -m pipeline explainer portrait add PHOTO --name "Jane Doe" --source URL --author "Photographer" --license "CC BY-SA 4.0"

- Only public-domain or Creative Commons photos (Wikimedia Commons is the usual place). Licences that forbid changes (ND)
  or commercial use (NC) are refused: tracing is a change, and the paper is a business. Never press or agency photos.
- Traced by potrace (not AI) at three levels of darkness, so the result is a 2-3 tone drawing in the themes' own colours
  (--line and tints of it); every theme recolours it. Clean it up by hand afterwards if needed.
- The credit is stored in <slug>.json and shown in small text on the frame whenever the portrait appears.
"""
from __future__ import annotations

import json
import re
import shutil
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path

DIR = Path(__file__).resolve().parent / "library" / "portraits"
ALLOWED = re.compile(r"^(cc0|cc-?0|pd|public domain|public-domain|cc[ -]by(-sa)?[ -]?\d(\.\d)?)", re.I)
REFUSED = re.compile(r"\b(nc|nd|non-?commercial|no-?deriv)", re.I)
LEVELS = (("pt-light", 0.78), ("pt-mid", 0.55), ("pt-ink", 0.32))      # class, how dark a pixel must be (0 = black) to belong


def slug(name: str) -> str:
    import unicodedata
    s = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def licence_ok(lic: str) -> bool:
    lic = (lic or "").strip()
    return bool(ALLOWED.match(lic)) and not REFUSED.search(lic)


def trace(photo: Path, height: int = 560) -> tuple:
    """(viewBox, svg body): one potrace pass per darkness level, stacked light to dark."""
    from PIL import Image, ImageFilter, ImageOps
    if not shutil.which("potrace"):
        raise RuntimeError("potrace is not installed (brew install potrace / apt install potrace)")
    with Image.open(photo) as im:
        g = ImageOps.exif_transpose(im).convert("L")
    g = g.resize((max(1, round(g.width * height / g.height)), height))
    g = ImageOps.autocontrast(g, cutoff=1).filter(ImageFilter.MedianFilter(5))
    body = []
    with tempfile.TemporaryDirectory() as tmp:
        for cls, level in LEVELS:
            bmp = Path(tmp) / f"{cls}.pbm"
            g.point(lambda v, t=level * 255: 0 if v < t else 255, mode="1").save(bmp)
            out = Path(tmp) / f"{cls}.svg"
            subprocess.run(["potrace", "-s", "--turdsize", "24", "--alphamax", "1.1", "--opttolerance", "0.4", "-o", str(out), str(bmp)], check=True, timeout=120)
            svg = out.read_text()
            g_open = re.search(r"<g transform=\"[^\"]+\"[^>]*>", svg)
            paths = re.findall(r"<path d=\"[^\"]+\"\s*/>", svg)
            if g_open and paths:
                transform = re.search(r'transform="([^"]+)"', g_open.group(0)).group(1)
                body.append(f'<g class="{cls}" transform="{transform}">' + "".join(paths) + "</g>")
    vb = f"0 0 {g.width} {g.height}"
    return vb, "".join(body)


def add(photo: Path, name: str, source: str, author: str, license: str, license_url: str = "", aliases=(), out_dir: Path = DIR) -> dict:
    if not licence_ok(license):
        raise ValueError(f"licence {license!r} is not allowed: use public-domain, CC0, CC BY or CC BY-SA photos (no NC, no ND)")
    if not source.startswith(("https://", "http://")):
        raise ValueError("--source must be the photo's page, e.g. its Wikimedia Commons file page")
    if not author.strip():
        raise ValueError("--author is required for the credit")
    vb, body = trace(Path(photo))
    if not body:
        raise ValueError("nothing was traced: the photo is too light or too small")
    out_dir.mkdir(parents=True, exist_ok=True)
    s = slug(name)
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}">{body}</svg>\n'
    via = "Wikimedia Commons" if "wikimedia.org" in source or "wikipedia.org" in source else re.sub(r"^https?://(www\.)?([^/]+).*$", r"\2", source)
    meta = {"name": name, "slug": s, "aliases": list(aliases), "source_url": source, "author": author.strip(), "license": license.strip(),
            "license_url": license_url, "attribution": f"Portrait traced from a photo by {author.strip()}, {license.strip()}, {via}",
            "made_with": "potrace (no AI), 3 tones", "added": datetime.now(timezone.utc).strftime("%Y-%m-%d")}
    (out_dir / f"{s}.svg").write_text(svg)
    (out_dir / f"{s}.json").write_text(json.dumps(meta, indent=1, ensure_ascii=False) + "\n")
    return meta
