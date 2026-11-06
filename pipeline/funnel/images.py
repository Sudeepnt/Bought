"""Stage "images": find real pictures for a story with plain rules: no model chooses, describes or generates anything.

Who may supply a picture, in order:
  publisher  the article's own image (not cleared: each issue lists these in rights_review.json for the licensing work)
  article    pictures Wikipedia editors chose for the thing the headline names, when hosted on Commons under a free licence
  commons    Wikimedia Commons, searched for that same thing; the file name must contain it
  (a free video clip from Commons goes first when one matches: six seconds, cut into frames, no sound)
  library    our own stand-in pictures, only when nothing else was found (picked by keyword, as before)
Commons and Wikipedia pictures must carry an allowed free licence.
"""
from __future__ import annotations

import hashlib
import io
import json
import logging
import re
import shutil
import subprocess
import time
from dataclasses import asdict
from pathlib import Path
from urllib.parse import urlsplit

from ..text import strip_html
from .contracts import ImageAsset

log = logging.getLogger(__name__)
NOT_CLEARED = "Not cleared"
COMMONS_API = "https://commons.wikimedia.org/w/api.php"
WIKI_API = "https://en.wikipedia.org/w/api.php"
MAX_BYTES = 15 * 1024 * 1024

KNOWN = ("OpenAI", "Anthropic", "Nvidia", "TSMC", "Apple", "Google", "Microsoft", "Meta", "Amazon", "Tesla", "SpaceX", "Intel", "AMD", "Samsung",
         "Huawei", "DeepSeek", "xAI", "Mistral", "Starlink", "Qualcomm", "Broadcom", "Oracle", "Netflix", "Uber", "Waymo", "ByteDance", "TikTok", "ASML")
# Names that mean something else on Wikipedia and Commons: the article we mean, and what to search for.
WIKI_TITLE = {"Apple": "Apple Inc.", "Meta": "Meta Platforms", "Amazon": "Amazon (company)", "Oracle": "Oracle Corporation", "Tesla": "Tesla, Inc.", "Intel": "Intel", "Uber": "Uber", "Google": "Google"}
ALIASES = {"Apple": ("Apple Park", "Apple Store"), "Meta": ("Meta Platforms", "Meta headquarters"), "Amazon": ("Amazon fulfillment", "Amazon Spheres"),
           "Oracle": ("Oracle headquarters", "Oracle Corporation"), "Google": ("Googleplex", "Google headquarters"), "Uber": ("Uber Technologies",),
           "Intel": ("Intel headquarters", "Intel processor"), "Tesla": ("Tesla Model", "Tesla Gigafactory")}
# A lone word in a headline counts as a name only if Wikipedia describes it as one of these: "Palantir" yes, "Johnson", "Boston" and "Download" no.
SUBJECT_NAME = re.compile(r"\b(compan(y|ies)|corporation|conglomerate|startup|manufacturer|developer|firm|business(man|woman|person)|entrepreneur|executive|investor|engineer|scientist|researcher|politician|"
                          r"president|senator|chief|founder|technolog|software|hardware|platform|standard|protocol|processor|service|app\b|website|model|chatbot|rocket|spacecraft|vehicle|device)", re.I)
# A topic ("data center", "jet engine") is fine unless Wikipedia says it is something else entirely.
SUBJECT_NOT = re.compile(r"\b(film|album|song|band|novel|episode|television|fiction|given name|surname|village|town|city|county|river|mountain|species|genus|painting|journal|magazine|newspaper|"
                         r"video game|book|poem|football|basketball|baseball|cricket|player|musician|singer|actor|actress|rapper|same term|disambiguation|list of)\b", re.I)
NOT_NAMES = frozenset("""a an the and or but of in on for to with at by from as is are was were be it its this that these those new how why what when who
 will can may could should would has have had not no more most after before over under into about than then now here there their his her our your my we you they
 ai us uk eu ceo cto cfo vc ipo api gpu cpu inc llc ltd corp co monday tuesday wednesday thursday friday saturday sunday january february march april may june july
 august september october november december today tomorrow yesterday report reports says said exclusive breaking update first big""".split())
REJECT_TITLE = re.compile(r"\b(logo|logos|logotype|icon|flag|map|seal|coat of arms|diagram|chart|graph|screenshot|signature|stamp|banner|poster|cover|album|wordmark|qr|barcode|cartoon|symbol|structure|noun|website|error|by state|by area|by country|statistics|table|login)\b", re.I)
_TOKEN = re.compile(r"[^\s]+")
_INNER_CAP = re.compile(r"^.+[A-Z]")


class SourcingError(RuntimeError):
    """The picture service could not be reached. Retry later, rather than freezing a video with stand-in pictures."""


def _clean(word: str) -> str:
    word = word.strip("\"'“”‘’()[]:;,.!?")
    return re.sub(r"['’]s$", "", word)


def topics_in(headline: str) -> list:
    """Two-word phrases in the headline, singular, to try as Wikipedia topics ("Data centers are..." -> "Data center")."""
    words = [_clean(w).lower() for w in _TOKEN.findall(headline)]
    single = lambda w: w[:-1] if len(w) > 3 and w.endswith("s") and not w.endswith("ss") else w
    usable = lambda w: len(w) > 2 and w not in NOT_NAMES and w.isalpha()
    return [f"{a} {single(b)}".capitalize() for a, b in zip(words, words[1:]) if usable(a) and usable(b)][:8]


def _is_cap(word: str) -> bool:
    return bool(word) and word[0].isupper()


def names_in(headline: str, summary: str = "") -> list:
    """The people, companies and places a headline may be about, by capitalisation (no model). Up to five, known names first.
    Headline Case makes every word look like a name, so then a word must also be capitalised mid-sentence in the summary."""
    tokens = _TOKEN.findall(headline)
    long_words = [t for t in map(_clean, tokens) if len(t) > 3]
    title_case = long_words and sum(_is_cap(t) for t in long_words) / len(long_words) > 0.7
    mid = {_clean(t) for s in re.split(r"(?<=[.!?])\s+", summary or "") for t in _TOKEN.findall(s)[1:] if _is_cap(_clean(t))}
    known = {k.lower(): k for k in KNOWN}

    def proper(word):
        low = word.lower()
        if low in known:
            return True
        if low in NOT_NAMES or not _is_cap(word) or len(word) < 3:
            return False
        if _INNER_CAP.match(word):           # TSMC, DeepSeek
            return True
        if title_case:
            return word in mid
        return True                          # a lone word still has to pass Wikipedia (resolve), so "Canva" stays and "Hiding" goes

    runs, cur = [], []
    for i, raw in enumerate(tokens):
        word = _clean(raw)
        if word and proper(word):
            cur.append(known.get(word.lower(), word))
            if raw[-1] in ",:;.!?" or re.search(r"['’]s\W*$", raw):
                runs.append(" ".join(cur)); cur = []
        elif cur:
            runs.append(" ".join(cur)); cur = []
    if cur:
        runs.append(" ".join(cur))
    seen, out = set(), []
    for name in sorted(runs, key=lambda r: (r not in KNOWN, -len(r.split()))):   # stable: same order every time
        if name.lower() not in seen:
            seen.add(name.lower()); out.append(name)
    return out[:5]


def _word_in(needle: str, text: str) -> bool:
    return re.search(r"(?<![A-Za-z0-9])" + re.escape(needle) + r"(?![A-Za-z0-9])", text, re.I) is not None


def license_ok(short: str, code: str, pattern: str) -> bool:
    return bool(re.match(pattern, f"{code or ''}".strip().lower())) or bool(re.match(pattern, f"{short or ''}".strip().lower().replace(" ", "-")))


def commons_candidates(page_list, name, cfg, now_year, need_name=True, clips=False) -> list:
    """Rank one search's results. Rights and fit first: anything failing them is out, not just ranked lower.
    need_name=False is for a Wikipedia article's own pictures: the file's description or categories may name the subject instead.
    An article's other pictures are out: the Google article also shows an EU building, which says nothing about Google."""
    out = []
    for p in page_list:
        if p.get("imagerepository", "shared") != "shared":   # a file hosted on Wikipedia itself may be fair use, not free
            continue
        title = re.sub(r"^File:|\.[a-z0-9]+$", "", p.get("title", ""), flags=re.I)
        info = (p.get("imageinfo") or [None])[0]
        if not info or info.get("mime") not in (("video/webm", "application/ogg") if clips else ("image/jpeg", "image/png", "image/webp")):
            continue
        if clips and float(info.get("duration") or 0) < 8:
            continue
        meta = info.get("extmetadata") or {}
        val = lambda k: strip_html(str((meta.get(k) or {}).get("value", "")))
        short, code = val("LicenseShortName"), val("License")
        if not license_ok(short, code, cfg.funnel_image_licenses) or val("NonFree").lower() == "true":
            continue
        author = val("Artist")
        if val("AttributionRequired").lower() == "true" and not author:
            continue
        w, h = int(info.get("width") or 0), int(info.get("height") or 0)
        if not h or w / h > 2.6 or w / h < (1.1 if need_name or clips else 0.66):   # the frame's monitor is wide; a portrait is framed on the face
            continue
        if w < (640 if clips else cfg.funnel_image_min_width if w > h else 600):
            continue
        if REJECT_TITLE.search(title):
            continue
        named = _word_in(name, title)
        if not named and (need_name or not (_word_in(name, val("ImageDescription")) or _word_in(name, val("Categories").replace("|", " ")))):
            continue
        year = re.search(r"(19|20)\d\d", val("DateTimeOriginal"))
        recent = bool(year) and now_year - int(year.group()) <= 5
        score = 3 + 3 * named + (w >= 1600) + (1.2 <= w / h <= 2.0) + recent
        out.append((score, title, {"url": info.get("thumburl") or info["url"], "page_url": info.get("descriptionurl", ""), "title": title,
                                   "author": author[:80], "license": short, "license_url": val("LicenseUrl"), "duration": float(info.get("duration") or 0)}))
    return [c[2] for c in sorted(out, key=lambda c: (-c[0], c[1]))]


def looks_like_a_page(img) -> bool:
    """A table, chart or screenshot, not a photograph: most of it is near-white or near one flat colour."""
    small = img.convert("L").resize((64, 36))
    px = small.tobytes()
    return sum(v > 235 for v in px) / len(px) > 0.45


def average_hash(img) -> str:
    small = img.convert("L").resize((8, 8))
    px = small.tobytes()
    mean = sum(px) / 64
    return f"{sum(1 << i for i, v in enumerate(px) if v > mean):016x}"


def _near(a: str, b: str) -> bool:
    return bin(int(a, 16) ^ int(b, 16)).count("1") <= 6


class Sourcer:
    """Finds pictures for one issue. Remembers what it used, so one photo does not run through every Nvidia story."""

    def __init__(self, cfg, cache_dir, client=None, now_year=2026, pause=1.0):
        self.cfg, self.cache, self.now_year, self.pause = cfg, Path(cache_dir), now_year, pause
        self.client = client
        self.used, self.used_hashes = set(), []

    def _http(self):
        if self.client is None:
            import httpx
            self.client = httpx.Client(headers={"User-Agent": self.cfg.user_agent}, timeout=self.cfg.http_timeout_seconds, follow_redirects=True)
        return self.client

    def _api(self, url, params) -> dict:
        import httpx
        try:
            r = self._http().get(url, params={"action": "query", "format": "json", **params})
            r.raise_for_status()
            data = r.json()
        except (httpx.HTTPError, ValueError) as e:
            raise SourcingError(f"{url} failed: {type(e).__name__}") from None
        time.sleep(self.pause)
        return data.get("query") or {}

    def _search(self, query):
        info = {"prop": "imageinfo", "iiprop": "url|size|mime|extmetadata", "iiurlwidth": 1920}
        return list(self._api(COMMONS_API, {"generator": "search", "gsrsearch": f'"{query}" filetype:bitmap', "gsrnamespace": 6, "gsrlimit": 25, **info}).get("pages", {}).values())

    def _search_clips(self, query):
        info = {"prop": "imageinfo", "iiprop": "url|size|mime|extmetadata"}
        return list(self._api(COMMONS_API, {"generator": "search", "gsrsearch": f'"{query}" filetype:video', "gsrnamespace": 6, "gsrlimit": 10, **info}).get("pages", {}).values())

    def _clip(self, c):
        """Cut six seconds out of a free video into numbered frames, without downloading the rest of it. None if it cannot be read."""
        from PIL import Image
        key = hashlib.sha1(c["url"].encode()).hexdigest()[:16]
        folder, side = self.cache / f"clip-{key}", self.cache / f"clip-{key}.json"
        if side.exists():
            return ImageAsset(**json.loads(side.read_text()))
        folder.mkdir(parents=True, exist_ok=True)
        start = min(c["duration"] * 0.1, 30)
        run = subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *(["-user_agent", self.cfg.user_agent] if c["url"].startswith("http") else []), "-ss", f"{start:.1f}", "-t", "6", "-i", c["url"], "-an",
                              "-vf", "fps=25,scale=1280:-2", "-q:v", "4", str(folder / "%04d.jpg")], capture_output=True, timeout=180)
        frames = sorted(folder.glob("*.jpg"))
        if run.returncode or len(frames) < 100:
            log.warning("video clip unusable: %s", c["url"][:120])
            shutil.rmtree(folder, ignore_errors=True)
            return None
        with Image.open(frames[len(frames) // 2]) as mid:
            asset = ImageAsset("commons", c["url"], c["page_url"], c["title"], c["author"], c["license"], c["license_url"], str(folder), mid.width, mid.height, average_hash(mid), len(frames))
        side.write_text(json.dumps(asdict(asset)))
        return asset

    def _article_files(self, title):
        info = {"prop": "imageinfo", "iiprop": "url|size|mime|extmetadata", "iiurlwidth": 1920}
        return list(self._api(WIKI_API, {"generator": "images", "titles": title, "gimlimit": 40, **info}).get("pages", {}).values())

    def resolve(self, names, topics) -> list:
        """Which of these really are a thing, per Wikipedia. Returns [(what we called it, article title)], names first."""
        asked = [WIKI_TITLE.get(n, n) for n in names] + topics
        if not asked:
            return []
        q = self._api(WIKI_API, {"titles": "|".join(asked[:50]), "redirects": 1, "prop": "description|pageprops", "ppprop": "disambiguation"})
        hop = {x["from"]: x["to"] for key in ("normalized", "redirects") for x in q.get(key, [])}
        pages = {p.get("title"): p for p in q.get("pages", {}).values()}

        def lookup(title):
            for _ in range(4):
                title = hop.get(title, title)
            return pages.get(title)

        out = []
        for name in names + topics:
            title = WIKI_TITLE.get(name, name)
            page = lookup(title)
            if not page or "missing" in page or "disambiguation" in page.get("pageprops", {}):
                continue
            about = page.get("description", "")
            if SUBJECT_NOT.search(about):
                continue
            is_lone_name = name in names and " " not in name and name not in KNOWN
            if is_lone_name and not SUBJECT_NAME.search(about):
                continue
            out.append((name, page["title"]))
        return out

    def _download(self, url, meta, provider):
        """Fetch once, check it really is a usable picture, store a normal JPEG. None if it is not usable."""
        from PIL import Image
        import httpx
        self.cache.mkdir(parents=True, exist_ok=True)
        key = hashlib.sha1(url.encode()).hexdigest()[:16]
        path, side = self.cache / f"{key}.jpg", self.cache / f"{key}.json"
        if path.exists() and side.exists():
            d = json.loads(side.read_text())
            return ImageAsset(**d)
        try:
            r = self._http().get(url)
            for wait in (5, 20, 60):                               # Wikimedia throttles bursts: wait as told, then try again
                if r.status_code != 429:
                    break
                time.sleep(float(r.headers.get("retry-after") or wait) if self.pause else 0)
                r = self._http().get(url)
            if r.status_code in (403, 404, 410):                   # this one file is refused or gone: try the next, it is not an outage
                log.warning("picture refused (HTTP %s): %s", r.status_code, url[:120])
                return None
            r.raise_for_status()
            if len(r.content) > MAX_BYTES:
                return None
            img = Image.open(io.BytesIO(r.content)).convert("RGB")
        except httpx.HTTPError as e:
            raise SourcingError(f"download failed: {type(e).__name__}") from None
        except OSError:
            return None
        finally:
            time.sleep(self.pause)
        if img.width < 600 or looks_like_a_page(img):
            return None
        img.thumbnail((1920, 1920))
        tmp = path.with_suffix(".tmp")
        img.save(tmp, "JPEG", quality=90)
        tmp.replace(path)
        asset = ImageAsset(provider=provider, url=url, path=str(path), width=img.width, height=img.height, phash=average_hash(img), **meta)
        side.write_text(json.dumps(asdict(asset)))
        return asset

    def _add(self, picked, asset) -> bool:
        if asset is None or any(_near(asset.phash, p.phash) for p in picked) or any(_near(asset.phash, h) for h in self.used_hashes):
            return False
        picked.append(asset)
        return True

    def for_story(self, item, use_publisher=False) -> list:
        want = self.cfg.funnel_images_per_story
        picked = []
        if use_publisher and item.get("image_url"):
            host = urlsplit(item["link"]).netloc.removeprefix("www.")
            self._add(picked, self._download(item["image_url"], {"page_url": item["link"], "title": item["headline"], "author": item.get("image_credit") or host,
                                                                 "license": NOT_CLEARED, "license_url": ""}, "publisher"))
        names = names_in(item["headline"], item.get("summary", ""))
        things = self.resolve(names, topics_in(item["headline"]))
        people = [t for t in things if t[0] in names]
        things = (people or things)[:3]                            # a named subject beats a general topic
        queues = []
        for name, title in things[:1] if self.cfg.funnel_video_clips else []:   # moving picture first, if a free one exists
            short = title.split(" (")[0].rstrip(".")
            for c in commons_candidates(self._search_clips(short), short, self.cfg, self.now_year, clips=True)[:2]:
                if c["url"] not in self.used and self._add(picked, self._clip(c)):
                    break
        for name, title in things:
            short = title.split(" (")[0].rstrip(".")
            queues.append(iter(commons_candidates(self._article_files(title), short, self.cfg, self.now_year, need_name=False)))
            for query in ALIASES.get(name, (short,)):
                queues.append(iter(commons_candidates(self._search(query), query, self.cfg, self.now_year)))
        while queues and len(picked) < want:                       # one from each source in turn, so a story about two companies shows both
            for q in list(queues):
                c = next((x for x in q if x["url"] not in self.used), None)
                if c is None:
                    queues.remove(q)
                    continue
                meta = {k: c[k] for k in ("page_url", "title", "author", "license", "license_url")}
                self._add(picked, self._download(c["url"], meta, "commons"))
                if len(picked) >= want:
                    break
        if not picked:
            picked = self.library(item)
        for a in picked:
            self.used.add(a.url)
            if a.provider != "library":
                self.used_hashes.append(a.phash)
        return picked

    def library(self, item) -> list:
        """Our stand-ins, best keyword match first. Used whole, never mixed with a real story picture."""
        from PIL import Image
        root = Path(__file__).resolve().parents[2]
        text = " ".join(str(item.get(k) or "") for k in ("headline", "summary", "category")).lower()
        words = set(re.findall(r"[a-z0-9]+", text))
        hits = {im: sum(1 for k in kw if k in words or (len(k) > 4 and k in text)) for im, kw in self.cfg.avatar_fallback_keywords.items()}
        pool = list(self.cfg.avatar_fallback_images)
        offset = int(item["id"], 16) % len(pool)
        order = sorted(pool, key=lambda im: (-hits.get(im, 0), (pool.index(im) - offset) % len(pool)))
        out = []
        for rel in order[:3]:
            path = root / rel
            with Image.open(path) as im:
                out.append(ImageAsset("library", rel, "", path.stem, "", "House library", "", str(path), im.width, im.height, average_hash(im)))
        return out
