"""Publish: turn a finished issue into what the site reads. Plain rules only; the same feed always gives the same page.

  out/issues/<date>/feed.json + media/   ->   public/issues/<date>/issue.json + media/ (+ podcast.mp3, translations/)
                                              public/issues/index.json   every published date, newest first
                                              public/s/<id>/             link-preview pages for stories with a video

Safe to rerun at any time: the issue's numbers are kept from the first publish, and files that did not change are not copied again.
"""
from __future__ import annotations

import hashlib
import io
import json
import logging
import os
import re
import shutil
import urllib.request
from pathlib import Path

log = logging.getLogger(__name__)
PKG = Path(__file__).resolve().parents[1]
ROOT = PKG.parent
PUBLIC = Path(os.environ.get("BOUGHT_PUBLIC") or ROOT / "public")
OUT = Path(os.environ.get("BOUGHT_OUT") or PKG / "out")

SECTIONS = {"AI": "AI", "Technology": "Technology", "Tech business": "Business", "Founders & startups": "Founders",
            "Product launches": "Launches", "Tech geopolitics": "Geopolitics"}
ORDER = ("AI", "Technology", "Business", "Founders", "Launches", "Geopolitics")
WRITER = {"AI": "Ira", "Technology": "Ira", "Business": "Kabir", "Founders": "Kabir", "Launches": "Rio", "Geopolitics": "Noor"}
KICKERS = (("IPO", r"\bIPOs?\b"), ("Funding", r"\b(raise[sd]?|raising|funding|series [a-f]|valuation|seed round)\b"),
           ("Earnings", r"\b(earnings|q[1-4] revenue|quarterly|revenue|profit|forecast)\b"), ("Deals", r"\b(acquir\w+|acquisition|merger|takeover|in talks)\b"),
           ("Jobs", r"\b(layoffs?|job cuts|hiring|cuts? [\w ]{0,12}team|closing its)\b"), ("Security", r"\b(hack\w*|breach\w*|cyber\w*|vulnerab\w+|malware|proxies|zero-day)\b"),
           ("Chips", r"\b(chips?|chipmakers?|semiconductors?|GPUs?|NAND|TSMC|Nvidia)\b"), ("Data centres", r"\bdata cent(er|re)s?\b"),
           ("Export controls", r"\b(export (curbs|controls?|bans?)|sanctions?|tariffs?)\b"), ("Courts", r"\b(court|judge|lawsuit|sued|ruling)\b"),
           ("Regulation", r"\b(regulat\w+|antitrust|ban(s|ned)?|Congress|midterms?)\b"), ("Launch", r"\b(launch\w*|unveil\w*|introduc\w+|releases?|previews?|announc\w+)\b"),
           ("Models", r"\b(LLMs?|models?|OpenAI|Anthropic|DeepSeek|Gemini)\b"))
NUMBER = re.compile(r"[$£€]\s?\d[\d,.]*\s?(?:trillion|billion|million|[TBMK]\b)?\+?|\b\d+(?:\.\d+)?%", re.I)
POLL = ("How much does this story matter to your work?", ["A lot", "A little", "Not at all"])
PULSE = "Which story matters most to your work today?"


def clean_headline(text: str, source: str = "") -> str:
    """Remove the reporter credit Techmeme adds. 'Sources: X' becomes 'X, sources say', so a report still reads as a report."""
    t = " ".join(str(text or "").split()).strip()
    t = re.sub(r"\s*\([^()]*/[^()]*\)$", "", t)
    if source == "Techmeme":                          # "(Financial Times)", "(XBOX Wire)": the outlet alone
        t = re.sub(r"\s*\([A-Z][^()]{1,40}\)$", "", t)
    t = t.rstrip(" .")
    m = re.match(r"^(Sources?):\s*(.+)$", t)
    if m:
        t = f"{m[2]}, {'sources say' if m[1] == 'Sources' else 'a source says'}"
    return t


def clean_summary(summary: str, headline: str) -> str:
    """The summary, without feed boilerplate or a repeat of the headline. Empty when nothing useful is left."""
    s = " ".join(str(summary or "").split()).strip()
    if s.startswith(("Article URL:", "Comments URL:")):
        return ""
    start = re.sub(r"\s*\([^()]*\)$", "", " ".join(str(headline or "").split()))[:40]
    at = s.find(start) if len(start) >= 12 else -1
    if at != -1 and at < 90:                          # "Tess Owen / Wired: <the headline> — the rest"
        dash = s.find(" — ", at)
        s = s[dash + 3:].strip() if dash != -1 else ""
    return s if len(s) >= 25 else ""


def split_sentences(text: str) -> list:
    parts = [x.strip() for x in re.split(r"(?<![A-Z]\.)(?<=[.!?])\s+(?=[A-Z“\"'])", text) if x.strip()]   # "T. Rowe Price" is not the end of a sentence
    while len(parts) > 1 and len(parts[0]) < 40:      # too short to stand alone as the summary line
        parts[:2] = [parts[0] + " " + parts[1]]
    return parts


def captions(script: str, size: int = 78) -> list:
    """The spoken script in caption-sized pieces, breaking at sentence ends first and between words otherwise."""
    pieces = []
    for sentence in re.split(r"(?<=[.!?…])\s+", " ".join(str(script or "").split())):
        line = ""
        for word in sentence.split():
            if line and len(line) + 1 + len(word) > size:
                pieces.append(line)
                line = word
            else:
                line = f"{line} {word}".strip()
        if line:
            pieces.append(line)
    return pieces


def kicker(headline: str, section: str) -> str:
    for label, pattern in KICKERS:
        if re.search(pattern, headline, re.I):
            return label
    return section


def short_label(text: str, limit: int) -> str:
    text = text.rstrip(" .")
    if len(text) <= limit:
        return text
    return text[:limit].rsplit(" ", 1)[0].rstrip(" ,;:—-") + "…"


def sentence(text: str) -> str:
    return text if text.endswith(("…", ".", "!", "?")) else text + "."


def _seed(*parts) -> int:
    return int(hashlib.sha1("\x1f".join(map(str, parts)).encode()).hexdigest()[:8], 16)


def _counts(key: str, n: int, low: int, high: int) -> list:
    """Sample counts for polls and reactions until there is a server to count them: the same story always gets the same numbers."""
    return [low + _seed(key, i) % (high - low) for i in range(n)]


def unique_items(feed: dict) -> list:
    """The stories, best first. The feed lists its top stories twice (prime and glance), so each is taken once."""
    seen, out = set(), []
    for slot in ("prime", "cards", "glance"):
        for item in feed.get(slot, []):
            if item["id"] not in seen:
                seen.add(item["id"])
                out.append(item)
    return out


def podcast_feed(feed: dict) -> dict:
    """The cleaned stories in the shape podcast.py and translate.py read, so listeners and translators get the same words as readers."""
    items = [{"id": i["id"], "headline": clean_headline(i["headline"], i.get("source", "")), "summary": clean_summary(i.get("summary"), i["headline"]),
              "category": SECTIONS.get(i["category"], i["category"]), "source": i.get("source", "")} for i in unique_items(feed)]
    return {"generated_at": feed.get("generated_at", ""), "prime": items, "cards": [], "glance": []}


def lay_out(feed: dict) -> list:
    """One entry per story: lead first, then the three top stories, then each section. Sizes follow the paper's template."""
    items = unique_items(feed)
    rich = lambda i: 2 if i.get("video_url") else 1 if i.get("image_url") else 0
    lead = next((i for i in items if i.get("video_url")), items[0] if items else None)
    rest = [i for i in items if i is not lead]
    tops = sorted(rest, key=lambda i: -rich(i))[:3]
    tops = [i for i in rest if any(i is t for t in tops)]
    stories = [(lead, "lead")] + [(i, "top") for i in tops] if lead else []
    left = [i for i in rest if not any(i is t for t in tops)]
    for name in ORDER:
        group = sorted([i for i in left if SECTIONS.get(i["category"]) == name], key=lambda i: -rich(i))
        for n, item in enumerate(group):
            # the last two of a full section run as "In brief" headlines; a story with a video never does
            brief = len(group) >= 5 and n >= len(group) - 2 and not item.get("video_url")
            stories.append((item, "b" if brief else "xl" if n == 0 else "m" if n < 3 else "s"))
    known = {i["id"] for i, _ in stories}
    stories += [(i, "s") for i in left if i["id"] not in known]        # a section we do not know still gets printed
    return stories


def story_entry(index: int, item: dict, size: str, picture) -> dict:
    section = SECTIONS.get(item["category"], "Technology")
    title = clean_headline(item["headline"], item.get("source", ""))
    summary = clean_summary(item.get("summary"), item["headline"])
    parts = split_sentences(summary)
    video = item.get("video_url")
    length = float(item.get("duration_s") or 0)
    media = "none"
    if video:
        media = "auto" if size in ("lead", "xl") or (size == "m" and index % 2) else "thumb"
    elif picture:
        media = "pic"
    return {"id": index, "uid": item["id"], "cat": section, "sz": size, "media": media, "len": round(length, 2), "min": max(1, round(length / 60)),
            "j": WRITER[section], "kick": kicker(title, section), "t": title, "dek": parts[0] if parts else "", "gist": parts[1:4] if len(parts) > 2 else [],
            "body": [" ".join(parts[1:])] if len(parts) == 2 else [], "why": "", "src": [item.get("source", ""), item.get("link", "")], "picture": picture,
            "credit": item.get("image_credit") or item.get("source", "")}


def language_ok(items: list, translated: dict, need: float = 0.9) -> bool:
    """A language goes out only if its headlines keep their numbers and are not just the English again. A plain check, not a judge of style."""
    digits = lambda t: set(re.findall(r"\d+", t.replace(",", "")))
    words = lambda t: set(re.findall(r"[a-z]{3,}", t.lower()))
    numbers = kept = copied = total = 0
    for item in items:
        tr = (translated.get(item["id"]) or {}).get("headline", "")
        if not tr:
            continue
        english = clean_headline(item["headline"], item.get("source", ""))
        total += 1
        if digits(english):
            numbers += 1
            kept += digits(english) <= digits(tr)
        if words(english) and len(words(english) & words(tr)) / len(words(english)) > 0.7:
            copied += 1
    if not total or copied / total > 1 - need:
        return False
    return not numbers or kept / numbers >= need


def fetch_picture(url: str, target: Path, user_agent: str) -> bool:
    """Keep a card's picture on our own server, sized for the page. A picture we cannot fetch is left out, never stands in as a broken image."""
    if target.exists():
        return True
    try:
        from PIL import Image
        req = urllib.request.Request(url, headers={"User-Agent": user_agent})
        with urllib.request.urlopen(req, timeout=20) as res:
            data = res.read(12_000_000)
        with Image.open(io.BytesIO(data)) as im:
            im = im.convert("RGB")
            im.thumbnail((960, 960))
            tmp = target.with_suffix(".tmp")
            target.parent.mkdir(parents=True, exist_ok=True)
            im.save(tmp, "JPEG", quality=82)
        os.replace(tmp, target)
        return True
    except Exception as e:
        log.warning("picture not fetched %s: %s", url, str(e)[:160])
        return False


def _copy(src: Path, dst: Path) -> None:
    if dst.exists() and dst.stat().st_size == src.stat().st_size and dst.stat().st_mtime >= src.stat().st_mtime:
        return
    dst.parent.mkdir(parents=True, exist_ok=True)
    tmp = dst.with_name(dst.name + ".tmp")
    shutil.copy2(src, tmp)
    os.replace(tmp, dst)


def _versioned(path: Path, url: str) -> str:
    return f"{url}?v={int(path.stat().st_mtime)}"


def funnel_stats(conn, sources: int, feed: dict) -> dict:
    """The real counts behind the issue, for 'How this issue was made'."""
    count = lambda q, *a: conn.execute(q, a).fetchone()[0]
    read = count("SELECT COUNT(*) FROM articles")
    dupes = count("SELECT COUNT(*) FROM articles WHERE reject_reason LIKE 'duplicate_of%'")
    rules = count("SELECT COUNT(*) FROM articles WHERE reject_reason LIKE 'rules:%'")
    expired = count("SELECT COUNT(*) FROM articles WHERE status='expired'")
    items = unique_items(feed)
    return {"read": read, "sources": sources, "duplicates": dupes, "unique": read - dupes, "on_brief": read - dupes - rules - expired, "off_brief": rules,
            "expired": expired, "published": len(items), "videos": sum(1 for i in items if i.get("video_url"))}


def build_page(date: str, feed: dict, pictures: dict, stats: dict, podcast, translations: list, share: set) -> dict:
    stories = []
    for n, (item, size) in enumerate(lay_out(feed)):
        entry = story_entry(n, item, size, pictures.get(item["id"]))
        if item.get("video_url"):
            entry["video"], entry["poster"] = pictures["video:" + item["id"]]
            entry["cc"] = captions(item.get("script", ""))
        entry["share"] = item["id"] in share
        stories.append(entry)
    by_size = lambda *sizes: [s for s in stories if s["sz"] in sizes]
    pool = [s for s in stories if s["sz"] != "b"]
    nums, used = [], set()
    for s in stories:
        m = NUMBER.search(s["t"])
        if m and m[0].lower() not in used and len(nums) < 5:
            used.add(m[0].lower())
            value = re.sub(r"\s+", "", m[0]).replace("billion", "B").replace("million", "M").replace("trillion", "T")
            nums.append([re.sub(r"(\d)([bmkt])\b", lambda x: x[1] + x[2].upper(), value), short_label(s["t"], 44), s["id"]])
    polls = {"pulse": {"q": PULSE, "o": [short_label(s["t"], 46) for s in stories[:3]], "v": _counts(date + "pulse", min(3, len(stories)), 900, 2200)}}
    for s in ([stories[0]] if stories else []) + by_size("xl")[:3]:
        polls[s["id"]] = {"q": POLL[0], "o": POLL[1], "v": _counts(s["uid"], 3, 300, 2200)}
    rx = {s["id"]: _counts(s["uid"] + "rx", 4, 40, 700) for s in by_size("m") if s["id"] not in polls}
    rx = dict(list(rx.items())[:6])
    return {"issue": date, "generated_at": feed.get("generated_at", ""), "stories": stories, "brief": [[s["id"], sentence(short_label(s["t"], 96))] for s in pool[:3]], "nums": nums,
            "clips": [s["id"] for s in stories if s.get("video")][:6], "polls": polls, "rx": {str(k): v for k, v in rx.items()},
            "podcast": podcast, "translations": translations, "stats": stats}


def publish(cfg, date: str, conn, sources: int, out_root=None, public_root=None, fetch=fetch_picture, build_share=True, site=None) -> dict:
    """Write one issue into the site. Returns what was published."""
    base = Path(out_root or OUT) / "issues" / date
    public = Path(public_root or PUBLIC)
    target = public / "issues" / date
    feed_path = base / "feed.json"
    if not feed_path.exists():
        raise FileNotFoundError(f"no feed for {date}: run the funnel build first")
    feed = json.loads(feed_path.read_text())
    if not unique_items(feed):
        raise ValueError(f"issue {date} has no stories")
    page_path = target / "issue.json"
    old = json.loads(page_path.read_text()) if page_path.exists() else {}

    pictures, card_pictures = {}, []
    for item in unique_items(feed):
        if item.get("video_url"):
            mp4, poster = base / "media" / f"{item['id']}.mp4", base / "media" / f"{item['id']}.jpg"
            _copy(mp4, target / "media" / mp4.name)
            _copy(poster, target / "media" / poster.name)
            url = f"issues/{date}/media/"
            pictures["video:" + item["id"]] = (_versioned(mp4, url + mp4.name), _versioned(poster, url + poster.name))
        elif item.get("image_url"):
            jpg = target / "media" / f"{item['id']}.jpg"
            if fetch(item["image_url"], jpg, cfg.user_agent):
                pictures[item["id"]] = f"issues/{date}/media/{jpg.name}"
                card_pictures.append({"article_id": item["id"], "picture": item["image_url"], "article": item.get("link", ""), "credit": item.get("image_credit") or ""})

    review_path = base / "rights_review.json"
    if review_path.exists():                          # the legal list covers every publisher picture shown, on cards too
        review = json.loads(review_path.read_text())
        review["card_pictures"] = card_pictures
        review_path.write_text(json.dumps(review, indent=2, ensure_ascii=False) + "\n")

    podcast = None
    mp3, meta = base / "media" / "podcast.mp3", base / "media" / "podcast.json"
    if mp3.exists() and meta.exists():
        info = json.loads(meta.read_text())
        _copy(mp3, target / "media" / "podcast.mp3")
        podcast = {"audio_url": _versioned(mp3, f"issues/{date}/media/podcast.mp3"), "duration_s": info["duration_s"], "chapters": info["chapters"]}

    translations, refused = [], []
    for path in sorted((base / "translations").glob("*.json")) if (base / "translations").exists() else []:
        if language_ok(unique_items(feed), json.loads(path.read_text())):
            _copy(path, target / "translations" / path.name)
            translations.append(path.stem)
        else:                                         # never show a reader news the translator made up
            (target / "translations" / path.name).unlink(missing_ok=True)
            refused.append(path.stem)
            log.warning("translation %s refused: it fails the number and copy checks", path.stem)

    stats = old.get("stats") or funnel_stats(conn, sources, feed)
    share = {i["id"] for i in unique_items(feed) if i.get("video_url")} if build_share else set()
    page = build_page(date, feed, pictures, stats, podcast, translations, share)
    if build_share:
        from ..share_pages import issue_pages
        issue_pages(page, target / "media", public, site=site)
    write_json(page_path, page)
    for item in unique_items(feed):                   # what ran today can't run again, however it was published
        conn.execute("UPDATE articles SET status='used', reject_reason=? WHERE id=?", (f"issue:{date}", item["id"]))

    dates = sorted({p.parent.name for p in (public / "issues").glob("*/issue.json")}, reverse=True)
    index = public / "issues" / "index.json"
    label = json.loads(index.read_text()).get("publish_label") if index.exists() else None
    write_json(index, {"latest": dates[0], "dates": dates, **({"publish_label": label} if label else {})})
    return {"stories": len(page["stories"]), "videos": sum(1 for s in page["stories"] if s.get("video")), "pictures": len(card_pictures),
            "podcast": bool(podcast), "translations": translations, "translations_refused": refused, "path": str(page_path)}


def write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    os.replace(tmp, path)


def build_audio(cfg, date: str, out_root=None) -> dict:
    """The day's episode: every story read aloud, with chapter marks. Segments are cached, so a rerun carries on where it stopped."""
    from ..podcast import build_podcast
    base = Path(out_root or OUT) / "issues" / date
    return build_podcast(cfg, podcast_feed(json.loads((base / "feed.json").read_text())), base / "media", PKG / "data" / "podcast")


def build_languages(cfg, date: str, out_root=None) -> dict:
    """Headlines and summaries in the picker's languages. Finished languages are cached; a language appears once all of it is done."""
    from ..translate import attach_translations, build_translations
    base = Path(out_root or OUT) / "issues" / date
    feed = podcast_feed(json.loads((base / "feed.json").read_text()))
    cache = PKG / "data" / "translations.json"
    stats = build_translations(cfg, feed, base, cache)
    stats["available"] = attach_translations(cfg, feed, base, cache)
    return stats
