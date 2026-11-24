"""The scene plan: the one AI step. Claude Haiku, through the Message Batches API (half price, run overnight), picks from the
library and writes the words; it draws nothing. The answer is JSON in a schema whose ids are enums from the library.

Before anything is rendered, plain code checks the plan (check()):
  - every id exists in the library (templates, objects, parts);
  - every quote appears word for word in a source; every highlight is inside its quote;
  - every number and date, and every person's name, in narration, cards and labels appears in the sources;
  - 4-7 scenes, the end card last, the length aims at 60-90 seconds.
A plan that fails is sent back once with the errors. If it fails again the story is marked "needs review" and gets no video.
No API key, or the call itself fails: a plan made by rules (rules_plan()), so a video is always possible.
"""
from __future__ import annotations

import json
import logging
import os
import re
import time
import unicodedata

from . import library

log = logging.getLogger(__name__)
PROMPT_VERSION = "1"
SECTIONS = {"AI": "AI", "Technology": "Technology", "Tech business": "Business", "Founders & startups": "Founders",
            "Product launches": "Launches", "Tech geopolitics": "Geopolitics"}

SYSTEM = """You plan short explainer videos for Bought., a daily tech, AI and business newspaper. A video is 4 to 7 scenes,
60 to 90 seconds when read aloud, and ends with an end_card. You choose scene templates and drawings ONLY from the
library below and write the narration and on-screen words. Code draws everything; you never describe images.

Rules, all checked by code before anything is shown:
- Use only facts in the story's sources. Do not add background knowledge, guesses or opinions.
- Every quote (source_quote.quote and card.quote) must be copied word for word from a source, at most 160 characters.
- Every number, date, weekday and month you write anywhere must appear in the sources. Do not compute new numbers
  (no differences, totals or conversions). If the sources have few numbers, use templates without numbers.
- Every person you name must be named in the sources.
- Narration: plain, short sentences, 1-3 per scene, each under 25 words. Present tense where natural. No hype.
- highlight and arrows may only use parts of the object you picked (listed with each object).
- Pick drawings that fit the story; prefer variety across scenes. The end_card has no narration.
- Answer with the JSON plan only.

THE LIBRARY
"""


def catalogue_text(cat: dict) -> str:
    """The library as compact text for the cached system prompt."""
    lines = ["Objects (id: parts; tags):"]
    for o in cat["objects"]:
        lines.append(f"- {o['id']}: {', '.join(o['parts'])}; {', '.join(o['tags'])}")
    lines.append("\nScene templates (id: what it shows; fields):")
    for t in cat["templates"]:
        fields = ", ".join(f"{k}{'' if k in t['required'] else '?'}" for k in t["fields"])
        lines.append(f"- {t['id']}: {t['summary']} Fields: {fields or 'none'}")
    lines.append("\nEvery scene except end_card has narration (what the voice says) and may have a card "
                 "{title, quote, highlight?, source}: a source's words shown beside the drawing.")
    if cat.get("portraits"):
        lines.append("\nPeople with portraits: " + ", ".join(p["name"] for p in cat["portraits"]))
    return "\n".join(lines)


def system_prompt(cat: dict) -> str:
    return SYSTEM + catalogue_text(cat)


def story_message(item: dict, sources: list, cfg) -> str:
    lo, hi = cfg.explainer_duration_s
    s_lo, s_hi = cfg.explainer_scenes
    return json.dumps({"story_id": item["id"], "section": SECTIONS.get(item.get("category"), item.get("category", "Technology")),
                       "headline": item["headline"], "duration_target_s": [lo, hi], "scenes": [s_lo, s_hi],
                       "sources": [{"name": s["name"], "url": s.get("url", ""), "text": s["text"]} for s in sources]}, ensure_ascii=False)


def sources_for(item: dict) -> list:
    """What the pipeline already fetched for this story: its headline and the publisher's own summary (never the full article)."""
    text = " ".join(x for x in (item.get("headline", ""), item.get("summary", "")) if x).strip()
    return [{"name": item.get("source", ""), "url": item.get("link", ""), "text": text}]


# ---------------------------------------------------------------- the checks (plain code)

_QUOTES = str.maketrans({"’": "'", "‘": "'", "“": '"', "”": '"', "–": "-", "—": "-", "−": "-", " ": " "})


def norm(text: str) -> str:
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", str(text or "")).translate(_QUOTES)).strip()


NUM = re.compile(r"(?<![\w.])\d+(?:[.,:]\d+)*")
SPELLED = {"two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10, "eleven": 11, "twelve": 12,
           "thirteen": 13, "fourteen": 14, "fifteen": 15, "sixteen": 16, "seventeen": 17, "eighteen": 18, "nineteen": 19, "twenty": 20,
           "thirty": 30, "forty": 40, "fifty": 50, "hundred": 100, "dozen": 12, "half": 0.5, "million": 1e6, "billion": 1e9, "trillion": 1e12}
DATEWORDS = re.compile(r"\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|"
                       r"September|October|November|December|yesterday|today|tomorrow|tonight|last week|next week|last year|next year)\b", re.I)


def numbers(text: str) -> set:
    """Numbers in a text, normalised: "1,200" -> "1200", "7:08" stays, "4.20" -> "4.2". Spelled numbers count too."""
    t = norm(text)
    out = set()
    for m in NUM.finditer(t):
        s = m.group(0)
        if ":" in s:
            out.add(s.lstrip("0") or "0")
            continue
        s = s.replace(",", "") if re.fullmatch(r"\d{1,3}(,\d{3})+(\.\d+)?", s) else s.replace(",", ".")
        try:
            v = float(s)
            out.add(f"{v:g}" if v < 1e15 else s)
        except ValueError:
            out.add(s)
    for w in re.findall(r"[a-z]+", t.lower()):
        if w in SPELLED:
            out.add("w:" + w)
    return out


def _source_numbers(texts: list) -> set:
    have = set()
    for t in texts:
        have |= numbers(t)
    for w, v in SPELLED.items():                      # "three" in the plan is fine when the sources say 3, and the other way round
        if f"{v:g}" in have:
            have.add("w:" + w)
        if "w:" + w in have:
            have.add(f"{v:g}")
    return have


def _strings(node, path=""):
    """Every string in a scene that readers see or hear, with where it is."""
    skip = {"template", "object", "highlight", "arrows", "size", "state", "mode", "kind", "winner", "part"}
    if isinstance(node, str):
        yield path, node
    elif isinstance(node, dict):
        for k, v in node.items():
            if k not in skip:
                yield from _strings(v, f"{path}.{k}" if path else k)
    elif isinstance(node, list):
        for i, v in enumerate(node):
            yield from _strings(v, f"{path}[{i}]")


def check(plan, item: dict, sources: list, cat: dict, cfg, rules=False) -> list:
    """Every reason this plan must not be rendered. An empty list means it passed. (The rules' plan is short on purpose:
    its scene count is not checked.)"""
    errs = []
    if not isinstance(plan, dict) or not isinstance(plan.get("scenes"), list):
        return ["the plan is not an object with a scenes list"]
    templates = {t["id"]: t for t in cat["templates"]}
    objects = {o["id"]: o for o in cat["objects"]}
    texts = [norm(s["text"]) for s in sources]
    joined = " \n ".join(texts)
    have = _source_numbers(texts)
    scenes = plan["scenes"]
    lo, hi = cfg.explainer_scenes
    if not rules and not lo <= len(scenes) <= hi:
        errs.append(f"the plan has {len(scenes)} scenes; it needs {lo} to {hi}")
    if not scenes or (scenes and scenes[-1].get("template") != "end_card"):
        errs.append("the last scene must be end_card")
    for i, sc in enumerate(scenes):
        where = f"scene {i + 1}"
        if not isinstance(sc, dict):
            errs.append(f"{where} is not an object")
            continue
        t = templates.get(sc.get("template"))
        if not t:
            errs.append(f"{where}: no template {sc.get('template')!r} in the library")
            continue
        if t["id"] == "end_card" and i != len(scenes) - 1:
            errs.append(f"{where}: end_card can only be the last scene")
        allowed = set(t["fields"]) | {"template"} | (set() if t["id"] == "end_card" else {"narration", "card"})
        for k in sc:
            if k not in allowed:
                errs.append(f"{where}: {t['id']} has no field {k!r}")
        for k in t["required"] + ([] if t["id"] == "end_card" else ["narration"]):
            if sc.get(k) in (None, "", [], {}):
                errs.append(f"{where}: {t['id']} needs {k}")
        for line in re.split(r"(?<=[.!?])\s+", norm(sc.get("narration", ""))) if not rules else []:   # the rules read the publisher's own sentences
            if len(line) > 180:
                errs.append(f"{where}: a narration sentence is too long ({len(line)} characters); keep each under 25 words")
        if t["id"] == "object":
            o = objects.get(sc.get("object"))
            if not o:
                errs.append(f"{where}: no object {sc.get('object')!r} in the library")
            else:
                parts = set(o["parts"])
                for p in sc.get("highlight") or []:
                    if p not in parts:
                        errs.append(f"{where}: {o['id']} has no part {p!r} (it has {', '.join(sorted(parts))})")
                for pair in sc.get("arrows") or []:
                    if not (isinstance(pair, list) and len(pair) == 2 and all(p in parts for p in pair)):
                        errs.append(f"{where}: arrow {pair!r} must join two parts of {o['id']}")
                for lab in sc.get("labels") or []:
                    if lab.get("part") not in parts:
                        errs.append(f"{where}: label for unknown part {lab.get('part')!r}")
        quotes = []
        if t["id"] == "source_quote":
            quotes.append(("quote", sc.get("quote"), sc.get("highlight")))
        if isinstance(sc.get("card"), dict) and sc["card"].get("quote"):
            quotes.append(("card.quote", sc["card"]["quote"], sc["card"].get("highlight")))
        for name, q, hl in quotes:
            if norm(q) not in joined:
                errs.append(f"{where}: {name} is not word for word in any source: {q!r}")
            if hl and norm(hl) not in norm(q):
                errs.append(f"{where}: highlight {hl!r} is not part of its quote")
        for path, s in _strings(sc):
            for n in numbers(s) - have:
                errs.append(f"{where}: {path} has {n.removeprefix('w:')!r}, which is not in the sources")
            for d in DATEWORDS.findall(s):
                if d.lower() not in joined.lower():
                    errs.append(f"{where}: {path} says {d!r}, which is not in the sources")
        for key in ("person", "from", "to"):                  # nobody the sources do not name
            p = sc.get(key)
            if isinstance(p, dict) and p.get("name"):
                name = norm(p["name"]).lower()
                if name not in joined.lower() and name.split(" ")[-1] not in joined.lower():
                    errs.append(f"{where}: {p['name']!r} is not named in the sources")
        if t["id"] == "bar_chart":
            for b in sc.get("bars") or []:
                shown = numbers(str(b.get("display", "")))
                if shown and f"{float(b.get('value', 0)):g}" not in shown and not any(_close(float(b.get('value', 0)), x) for x in shown):
                    errs.append(f"{where}: bar {b.get('label')!r} has value {b.get('value')} but shows {b.get('display')!r}")
        if t["id"] == "line_chart":
            for v in sc.get("series") or []:
                if f"{float(v):g}" not in have:
                    errs.append(f"{where}: series value {v:g} is not in the sources")
        if t["id"] == "versus":
            for r in sc.get("rows") or []:
                for side in ("a", "b"):
                    if f"{float(r.get(side, 0)):g}" not in have:
                        errs.append(f"{where}: {r.get('label')!r} value {r.get(side)} is not in the sources")
    return errs


def _close(v: float, s: str) -> bool:
    try:
        x = float(s)
    except ValueError:
        return False
    return any(abs(v - x * k) < 1e-6 * max(1, abs(v)) for k in (1, 1e3, 1e6, 1e9, 1e12))


# ---------------------------------------------------------------- the plan made by rules (no AI)

# Drawings that would say something on their own (a falling line, APPROVED, a charge level, someone's face, a hierarchy):
# the rules' plan never uses them, because it cannot know whether that is true.
NOT_FOR_RULES = {"stock_line", "stamp", "battery", "avatar", "org_tree", "crowd", "undersea_cable", "bug", "padlock", "shield"}
SECTION_OBJECT = {"AI": "chip", "Technology": "laptop", "Business": "coin_stack", "Founders": "document", "Launches": "phone", "Geopolitics": "globe"}


MONEY = re.compile(r"^[$£€~]*\d[\d.,]*\s?(%|[BMKT]|bn)?\+?$", re.I)


def kinetic_lines(headline: str, width: int = 18, most: int = 5) -> list:
    """The headline as big type: short lines, a money or percent figure on a huge line of its own, and an ellipsis when it runs long."""
    lines, cur = [], []
    for w in headline.rstrip(".").split(" "):
        bare = w.strip(",;:")
        if MONEY.match(bare) and any(c.isdigit() for c in bare) and not any(l["size"] == "xl" for l in lines):
            if cur:
                lines.append({"text": " ".join(cur), "size": "md"})
                cur = []
            lines.append({"text": bare, "size": "xl"})
            continue
        if cur and len(" ".join(cur + [w])) > width:
            lines.append({"text": " ".join(cur), "size": "md"})
            cur = []
        cur.append(w)
    if cur:
        lines.append({"text": " ".join(cur), "size": "md"})
    if len(lines) > most:
        lines = lines[:most]
        lines[-1] = {"text": lines[-1]["text"].rstrip(",;:") + "…", "size": lines[-1]["size"]}
    return lines


def rules_plan(item: dict, cat: dict) -> dict:
    """No key, or the call failed: the headline as kinetic type, a drawing for the section with the summary read out, the end card.
    Every word comes from the sources, so it passes the checks."""
    from ..funnel.publish import clean_headline, clean_summary       # the same clean text readers see: no bylines, no repeated headline
    section = SECTIONS.get(item.get("category"), "Technology")
    headline = norm(clean_headline(item["headline"], item.get("source", "")))
    kin = kinetic_lines(headline)
    text = f"{headline.rstrip('.')}."
    summary = norm(clean_summary(item.get("summary", ""), item["headline"]))
    hay = (headline + " " + summary).lower()
    pool = [o for o in cat["objects"] if o["id"] not in NOT_FOR_RULES]
    obj = max(pool, key=lambda o: sum(1 for t in o["tags"] if re.search(r"\b" + re.escape(t) + r"\b", hay)))
    if not any(re.search(r"\b" + re.escape(t) + r"\b", hay) for t in obj["tags"]) or obj["id"] in NOT_FOR_RULES:
        obj = next(o for o in cat["objects"] if o["id"] == SECTION_OBJECT[section])
    first = next(iter(obj["parts"]))
    scenes = [{"template": "kinetic_type", "lines": kin, "narration": text}]
    scenes.append({"template": "object", "object": obj["id"], "highlight": [first], "narration": summary or text})
    scenes.append({"template": "end_card"})
    return {"story_id": item["id"], "section": section, "duration_target_s": 20, "scenes": scenes}


# ---------------------------------------------------------------- the batch

class BatchClient:
    """The Message Batches API through the official SDK. Tests pass their own object with the same three methods."""

    def __init__(self):
        import anthropic
        self.client = anthropic.Anthropic()

    def submit(self, requests: list) -> str:
        return self.client.messages.batches.create(requests=requests).id

    def status(self, batch_id: str) -> str:
        return self.client.messages.batches.retrieve(batch_id).processing_status

    def results(self, batch_id: str):
        """(custom_id, "succeeded" | "errored" | ..., text or error, stop_reason)"""
        for r in self.client.messages.batches.results(batch_id):
            if r.result.type == "succeeded":
                msg = r.result.message
                yield r.custom_id, "succeeded", next((b.text for b in msg.content if b.type == "text"), ""), msg.stop_reason
            else:
                err = getattr(getattr(r.result, "error", None), "error", None) or getattr(r.result, "error", None)
                yield r.custom_id, r.result.type, str(getattr(err, "type", err) or r.result.type), None


def has_key() -> bool:
    return bool(os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN"))


def request(item: dict, sources: list, cat: dict, cfg, history=()) -> dict:
    params = {
        "model": cfg.explainer_model,
        "max_tokens": 8000,                      # Haiku thinks by default, and thinking counts toward max_tokens
        "output_config": {"effort": "low", "format": {"type": "json_schema", "schema": cat["schema"]}},
        "system": [{"type": "text", "text": system_prompt(cat), "cache_control": {"type": "ephemeral"}}],   # the same for every story: cached
        "messages": [{"role": "user", "content": story_message(item, sources, cfg)}, *history],
    }
    return {"custom_id": item["id"], "params": params}


SCHEMA = """
CREATE TABLE IF NOT EXISTS explainer_batches (
    issue    TEXT NOT NULL,
    round    INTEGER NOT NULL,
    batch_id TEXT NOT NULL,
    stories  TEXT NOT NULL,          -- JSON list of article ids in this batch
    created  TEXT NOT NULL,
    PRIMARY KEY (issue, round)
);
"""


def run_batch(conn, client, date: str, rnd: int, reqs: list, cfg, now_iso: str, sleep=time.sleep) -> dict:
    """Submit (or pick up an earlier submission of) one batch and wait for it. Returns {id: (status, text, stop_reason)}.
    A rerun after a crash keeps waiting for the same batch instead of paying for a new one."""
    conn.executescript(SCHEMA)
    ids = sorted(r["custom_id"] for r in reqs)
    row = conn.execute("SELECT * FROM explainer_batches WHERE issue=? AND round=?", (date, rnd)).fetchone()
    if row and json.loads(row["stories"]) == ids:
        batch_id = row["batch_id"]
    else:
        batch_id = client.submit(reqs)
        conn.execute("INSERT OR REPLACE INTO explainer_batches VALUES (?,?,?,?,?)", (date, rnd, batch_id, json.dumps(ids), now_iso))
        conn.commit()
    deadline = time.monotonic() + cfg.explainer_batch_wait_seconds
    while client.status(batch_id) != "ended":
        if time.monotonic() >= deadline:
            raise TimeoutError(f"batch {batch_id} did not finish within {cfg.explainer_batch_wait_seconds:.0f}s")
        sleep(cfg.explainer_batch_poll_seconds)
    return {cid: (kind, text, stop) for cid, kind, text, stop in client.results(batch_id)}


def plan_stories(conn, cfg, date: str, items: list, now_iso: str, client=None, sleep=time.sleep) -> dict:
    """Plans for these stories: {id: {"plan", "source": "ai"|"rules", "checks": [...], "status": "ok"|"needs_review", "tries"}}.
    One batch for all of them, then one batch to fix the ones that failed the checks."""
    cat = library.catalogue()
    sources = {i["id"]: sources_for(i) for i in items}
    out = {}

    def rules(i, why):
        p = rules_plan(i, cat)
        errs = check(p, i, sources[i["id"]], cat, cfg, rules=True)
        out[i["id"]] = {"plan": p, "source": "rules", "checks": errs, "status": "needs_review" if errs else "ok", "tries": 0, "note": why}

    if not items:
        return out
    if client is None and not has_key():
        for i in items:
            rules(i, "no API key: the plan was made by rules")
        return out
    try:
        client = client or BatchClient()
        got = run_batch(conn, client, date, 1, [request(i, sources[i["id"]], cat, cfg) for i in items], cfg, now_iso, sleep)
    except Exception as e:                                     # the call itself failed: still make a video
        log.warning("plan batch failed: %s", e)
        for i in items:
            rules(i, f"the AI call failed ({type(e).__name__}: {str(e)[:120]}): the plan was made by rules")
        return out
    retry = []
    for i in items:
        kind, text, stop = got.get(i["id"], ("missing", "", None))
        if kind != "succeeded":
            rules(i, f"the AI call for this story {kind}: the plan was made by rules")
            continue
        plan, errs = _parse(text, stop)
        errs = errs or check(plan, i, sources[i["id"]], cat, cfg)
        if errs:
            retry.append((i, text, errs))
        else:
            out[i["id"]] = {"plan": plan, "source": "ai", "checks": [], "status": "ok", "tries": 1}
    if retry:
        reqs = [request(i, sources[i["id"]], cat, cfg, history=[{"role": "assistant", "content": text or "{}"}, {"role": "user", "content":
                "These checks failed. Answer again with a corrected plan that passes all of them:\n- " + "\n- ".join(errs[:30])}]) for i, text, errs in retry]
        try:
            got2 = run_batch(conn, client, date, 2, reqs, cfg, now_iso, sleep)
        except Exception as e:
            got2 = {}
            log.warning("plan retry batch failed: %s", e)
        for i, text, errs in retry:
            kind, text2, stop = got2.get(i["id"], ("missing", "", None))
            plan, errs2 = _parse(text2, stop) if kind == "succeeded" else (None, [f"the second try {kind}"])
            errs2 = errs2 or check(plan, i, sources[i["id"]], cat, cfg)
            out[i["id"]] = {"plan": plan if plan is not None else _safe_json(text), "source": "ai", "checks": errs2, "status": "needs_review" if errs2 else "ok", "tries": 2,
                            "first_checks": errs}
    return out


def _parse(text: str, stop):
    if stop == "refusal":
        return None, ["the model declined this story"]
    if stop == "max_tokens":
        return None, ["the answer was cut off"]
    try:
        return json.loads(text), []
    except (TypeError, ValueError):
        return None, ["the answer is not valid JSON"]


def _safe_json(text):
    try:
        return json.loads(text)
    except (TypeError, ValueError):
        return None
