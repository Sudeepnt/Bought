"""Link-preview pages: one static page per Prime story and Pulse clip, so a shared link shows that story's picture and video.

Link-preview bots (WhatsApp, iMessage, Slack, Discord, Telegram, LinkedIn, Facebook, X) do not run JavaScript and never see the
part of a link after '#'. So every story gets a real URL, /s/<id>/, whose HTML already carries the Open Graph and Twitter tags
(title, description, image, video). People who open it are sent on to the story in the issue.

  ~/.cache/bought/tts/venv/bin/python -m pipeline.share_pages            # SITE_URL=https://your-domain to change the address

Writes public/share/<id>.jpg (1200x630 preview image) and public/s/<id>/index.html. The tags need absolute https addresses,
so SITE_URL must be the real public address of the site.
"""
from __future__ import annotations

import html
import json
import os
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
PUB = ROOT / "public"
SITE = os.environ.get("SITE_URL", "https://btnui.vercel.app").rstrip("/")
W, H = 1200, 630
NEWS = str(ROOT / "pipeline/assets/newsreader.ttf")
DM = str(PUB / "assets/font-0.ttf")


def nr(size, weight="ExtraBold"):
    f = ImageFont.truetype(NEWS, size); f.set_variation_by_name(weight); return f


def wrap(text, f, maxw):
    lines, cur = [], ""
    for w in text.split():
        t = (cur + " " + w).strip()
        if f.getlength(t) <= maxw or not cur:
            cur = t
        else:
            lines.append(cur); cur = w
    return lines + ([cur] if cur else [])


def backdrop(poster: Image.Image) -> Image.Image:
    bg = poster.copy()
    s = max(W / bg.width, H / bg.height)
    bg = bg.resize((int(bg.width * s) + 1, int(bg.height * s) + 1))
    bg = bg.crop(((bg.width - W) // 2, (bg.height - H) // 2, (bg.width - W) // 2 + W, (bg.height - H) // 2 + H))
    bg = bg.filter(ImageFilter.GaussianBlur(26))
    return Image.blend(bg, Image.new("RGB", (W, H), (10, 8, 14)), 0.55)


def play_badge(img: Image.Image, cx: int, cy: int, r: int = 52):
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0)); d = ImageDraw.Draw(layer)
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(20, 18, 16, 150), outline=(255, 255, 255, 220), width=4)
    d.polygon([(cx - r * .3, cy - r * .42), (cx - r * .3, cy + r * .42), (cx + r * .5, cy)], fill=(255, 255, 255, 255))
    img.paste(Image.alpha_composite(img.convert("RGBA"), layer).convert("RGB"))


def card_wide(poster_path: Path, out: Path):
    p = Image.open(poster_path).convert("RGB")
    img = backdrop(p)
    fit = p.resize((int(p.width * H / p.height), H), Image.LANCZOS)      # whole frame, full height, nothing cropped
    img.paste(fit, ((W - fit.width) // 2, 0))
    play_badge(img, W // 2, H // 2)
    img.save(out, quality=88)


def card_tall(poster_path: Path, out: Path, category: str, headline: str):
    p = Image.open(poster_path).convert("RGB")
    img = backdrop(p)
    ph = H - 70; fit = p.resize((int(p.width * ph / p.height), ph), Image.LANCZOS)
    x0 = 70; img.paste(fit, (x0, 35))
    play_badge(img, x0 + fit.width // 2, 35 + ph // 2, 44)
    d = ImageDraw.Draw(img)
    tx = x0 + fit.width + 60; maxw = W - tx - 60
    d.text((tx, 120), category.upper(), font=ImageFont.truetype(DM, 26), fill=(255, 140, 130))
    f = nr(58, "Bold"); y = 170
    for ln in wrap(headline, f, maxw)[:5]:
        d.text((tx, y), ln, font=f, fill=(255, 255, 255)); y += 68
    d.text((tx, H - 95), "Bought.  ·  Pulse", font=nr(34), fill=(255, 255, 255))
    img.save(out, quality=88)


def page(slug, title, desc, image, video, vw, vh, redirect, category):
    e = html.escape
    url = f"{SITE}/s/{slug}/"
    tags = [("og:type", "video.other"), ("og:site_name", "Bought."), ("og:title", title), ("og:description", desc), ("og:url", url),
            ("og:image", image), ("og:image:secure_url", image), ("og:image:type", "image/jpeg"), ("og:image:width", str(W)), ("og:image:height", str(H)),
            ("og:image:alt", title), ("og:video", video), ("og:video:secure_url", video), ("og:video:type", "video/mp4"),
            ("og:video:width", str(vw)), ("og:video:height", str(vh))]
    tw = [("twitter:card", "summary_large_image"), ("twitter:title", title), ("twitter:description", desc), ("twitter:image", image), ("twitter:image:alt", title)]
    meta = "\n".join([f'  <meta property="{k}" content="{e(v)}">' for k, v in tags] + [f'  <meta name="{k}" content="{e(v)}">' for k, v in tw])
    return f'''<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{e(title)} — Bought.</title>
  <meta name="description" content="{e(desc)}">
  <link rel="canonical" href="{e(url)}">
{meta}
  <style>body{{margin:0;min-height:100vh;display:grid;place-items:center;background:#efece5;color:#16150f;font:16px/1.5 system-ui,sans-serif}}main{{max-width:560px;padding:24px}}img{{width:100%;border-radius:10px;display:block}}h1{{font:700 28px/1.15 Georgia,serif;margin:18px 0 8px}}p{{margin:0 0 16px;color:#625a51}}a{{color:#16150f;font-weight:600}}</style>
  <script>location.replace({json.dumps(redirect)});</script>
</head>
<body>
  <main>
    <img src="{e(image)}" alt="">
    <p style="margin-top:14px;font-size:12px;letter-spacing:.1em;text-transform:uppercase">{e(category)}</p>
    <h1>{e(title)}</h1>
    <p>{e(desc)}</p>
    <a href="{e(redirect)}">Open in Bought. →</a>
  </main>
</body>
</html>
'''


def main():
    (PUB / "share").mkdir(exist_ok=True)
    made = 0
    # the issue's own card, for plain links to the site
    img = Image.new("RGB", (W, H), (239, 236, 229)); d = ImageDraw.Draw(img)
    d.text((90, 200), "Bought.", font=nr(190), fill=(22, 21, 15))
    d.text((96, 430), "Today’s issue: the news, as short videos you can watch.", font=nr(40, "SemiBold"), fill=(98, 90, 81))
    img.save(PUB / "share/site.jpg", quality=88)
    # Prime stories (wide 16:9 videos)
    feed = json.loads((ROOT / "pipeline/out/dry_run/feed.json").read_text())["prime"][:20]
    for it in feed:
        sid = it["id"]; poster = PUB / f"prime/{sid}.jpg"
        if not poster.exists():
            continue
        card_wide(poster, PUB / f"share/{sid}.jpg")
        desc = f"{it['category']}. {it['summary']}"[:200]
        out = PUB / f"s/{sid}"; out.mkdir(parents=True, exist_ok=True)
        (out / "index.html").write_text(page(sid, it["headline"], desc, f"{SITE}/share/{sid}.jpg", f"{SITE}/prime/{sid}.mp4", 1280, 720, f"../../#s-{sid}", it["category"]))
        made += 1
    # Pulse clips (tall 9:16 videos): only the three the page shows
    for c in json.loads((ROOT / "pipeline/pulse_clips.json").read_text())[:3]:
        slug = "pulse-" + c["slug"]; poster = PUB / f"pulse/{c['slug']}.pulse.jpg"
        card_tall(poster, PUB / f"share/{slug}.jpg", c["category"], c["headline"])
        out = PUB / f"s/{slug}"; out.mkdir(parents=True, exist_ok=True)
        (out / "index.html").write_text(page(slug, c["headline"], f"{c['happened']} {c['matters']}", f"{SITE}/share/{slug}.jpg",
                                             f"{SITE}/pulse/{c['slug']}.pulse.mp4", 720, 1280, f"../../#{slug}", c["category"]))
        made += 1
    print(f"{made} preview pages, site address {SITE}")


if __name__ == "__main__":
    sys.exit(main())
