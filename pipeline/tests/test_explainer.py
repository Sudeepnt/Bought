"""The explainer engine (pipeline/explainer/): the library, the plan and its checks, the fallbacks, themes, portraits,
deterministic rendering, the desk, and one full run from source to the paper playing the video."""
import hashlib
import json
import math
import re
import shutil
import socket
import subprocess
import sys
import threading
import wave
from dataclasses import replace
from datetime import datetime, timezone
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
from types import SimpleNamespace

import pytest

from pipeline import db
from pipeline.config import load_config
from pipeline.explainer import build as eb, library, plan as planner, portraits, themes, voice as voicer
from pipeline.funnel import issue as fi, publish as fp

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
FIX = HERE / "fixtures" / "explainer"
EXPL = ROOT / "pipeline" / "explainer"
CFG = load_config()
STORY = json.loads((FIX / "story.json").read_text())
RECORDED = json.loads((FIX / "haiku_response.json").read_text())
CHROMIUM = (ROOT / "node_modules" / "playwright-core").exists() and any(Path.home().glob("Library/Caches/ms-playwright/chromium*")) or any(Path("/root/.cache/ms-playwright").glob("chromium*")) if Path("/root").exists() else False
needs_browser = pytest.mark.skipif(not shutil.which("node") or not (ROOT / "node_modules" / "playwright-core").exists(), reason="node and playwright-core needed")
needs_ffmpeg = pytest.mark.skipif(not shutil.which("ffmpeg"), reason="ffmpeg needed")


# ---------------------------------------------------------------- the library

def test_the_library_has_everything_the_brief_asks_for():
    cat = library.catalogue()
    ids = {o["id"] for o in cat["objects"]}
    want = {"chip", "datacenter", "server_rack", "cloud_region", "laptop", "phone", "smartwatch", "vr_headset", "robot_arm", "drone", "battery", "ev_car",
            "charging_plug", "satellite", "rocket", "launch_site", "globe", "orbit", "undersea_cable", "cell_tower", "power_plant", "wind_turbine", "solar_panel",
            "factory", "warehouse", "ship", "plane", "truck", "document", "stamp", "courthouse", "parliament", "handshake", "coin_stack", "stock_line",
            "shopping_cart", "padlock", "shield", "bug", "key", "network_graph", "avatar", "crowd", "org_tree"}
    assert want <= ids
    assert {t["id"] for t in cat["templates"]} == {"object", "source_quote", "timeline", "big_number", "kinetic_type", "bar_chart", "line_chart", "gauge", "versus",
                                                  "checklist", "org_tree", "handover", "map_route", "network_spread", "document_annotate", "phone_callouts", "orbit", "end_card"}
    assert len(cat["themes"]) == 20 and len({t["id"] for t in cat["themes"]}) == 20
    assert all(t["layout"]["9x16"] and t["layout"]["16x9"] for t in cat["themes"])
    assert all(o["parts"] for o in cat["objects"]) and {"zoneA", "zoneB", "zoneC"} <= set(next(o for o in cat["objects"] if o["id"] == "datacenter")["parts"])


def test_drawings_use_only_theme_colours():
    out = subprocess.run(["node", "-e", "const l=require('./library/index.cjs');const s=l.objectIds().map(id=>l.drawObject(id,{highlight:Object.keys(l.OBJECTS.get(id).parts)})).join('');process.stdout.write(s)"],
                         cwd=EXPL, capture_output=True, check=True).stdout.decode()
    assert not re.search(r"#[0-9a-fA-F]{3,6}\b|rgba?\(", out), "a drawing has a fixed colour"
    base = (EXPL / "library" / "base.css").read_text()
    drawings = base[base.index("/* ================= the drawings"):base.index("/* ================= templates")]
    assert not re.search(r"#[0-9a-fA-F]{3,6}\b", drawings)


def test_the_plan_schema_only_allows_what_the_library_has():
    cat = library.catalogue()
    scenes = {s["properties"]["template"]["const"]: s for s in cat["schema"]["properties"]["scenes"]["items"]["anyOf"]}
    assert set(scenes) == {t["id"] for t in cat["templates"]}
    assert set(scenes["object"]["properties"]["object"]["enum"]) == {o["id"] for o in cat["objects"]}
    assert "zoneB" in scenes["object"]["properties"]["highlight"]["items"]["enum"]
    def closed(node):                            # structured outputs need every object closed
        if isinstance(node, dict):
            if node.get("type") == "object":
                assert node.get("additionalProperties") is False, node
            for v in node.values():
                closed(v)
        elif isinstance(node, list):
            for v in node:
                closed(v)
    closed(cat["schema"])


@needs_browser
@pytest.mark.parametrize("theme", [t["id"] for t in library.themes()])
def test_every_template_in_every_theme_and_ratio_fits_its_frame(theme, tmp_path):
    """Short and long text, both ratios: no text leaves the frame or is cut off by the stage (lines are clamped instead)."""
    bad = []
    for ratio in ("9x16", "16x9"):
        page = tmp_path / f"{theme}-{ratio}.html"
        library.node("matrix", theme, ratio, page)
        bad += [dict(b, ratio=ratio) for b in library.node("overflow", page, ratio, timeout=240)]
    assert bad == []


# ---------------------------------------------------------------- the checks

def sources():
    return planner.sources_for(STORY)


def good_plan():
    return json.loads(json.dumps(RECORDED["text"]))


def test_the_recorded_plan_passes_every_check():
    assert planner.check(good_plan(), STORY, sources(), library.catalogue(), CFG) == []


@pytest.mark.parametrize("change,why", [
    (lambda p: p["scenes"][2].update(quote="Some services in the region will see no errors"), "word for word"),
    (lambda p: p["scenes"][0]["card"].update(quote="A power event at 7:09 in zone B"), "word for word"),
    (lambda p: p["scenes"][1].update(narration="It took 9 hours to fix."), "'9'"),
    (lambda p: p["scenes"][1].update(narration="Services were restored on Tuesday."), "Tuesday"),
    (lambda p: p["scenes"][1].update(narration="Three teams worked on it."), "'three'"),
    (lambda p: p["scenes"][0].update(object="spaceship"), "no object"),
    (lambda p: p["scenes"][0].update(highlight=["core"]), "no part"),
    (lambda p: p["scenes"][0].update(arrows=[["zoneB", "moon"]]), "arrow"),
    (lambda p: p["scenes"].insert(0, {"template": "end_card"}), "only be the last"),
    (lambda p: p["scenes"].pop(), "last scene must be end_card"),
    (lambda p: p.update(scenes=p["scenes"][:2] + [{"template": "end_card"}]), "scenes"),
    (lambda p: p["scenes"].insert(0, {"template": "handover", "from": {"name": "Ada Lovelace"}, "to": {"name": "Jane Roe"}, "narration": "A change at the top."}), "not named"),
    (lambda p: p["scenes"][2].update(highlight="green lights"), "not part of its quote"),
    (lambda p: p["scenes"][1].update(template="hologram"), "no template"),
    (lambda p: p["scenes"][1].update(colour="red"), "no field"),
])
def test_a_plan_with_an_invented_fact_or_id_fails(change, why):
    p = good_plan()
    change(p)
    errs = planner.check(p, STORY, sources(), library.catalogue(), CFG)
    assert errs and any(why.lower() in e.lower() for e in errs), errs


def test_numbers_are_compared_as_numbers_and_spelled_ones_count():
    assert planner.numbers("$1,200 and 7:08 and 4.20%") >= {"1200", "7:08", "4.2"}
    have = planner._source_numbers(["3 companies"])
    assert "w:three" in have and "3" in have


# ---------------------------------------------------------------- the fallbacks

class Recorded:
    """Stands in for the Batch API: answers each round from a list of recorded texts per story."""

    def __init__(self, *rounds):
        self.rounds, self.submitted = list(rounds), []

    def submit(self, requests):
        self.submitted.append(requests)
        return f"msgbatch_{len(self.submitted)}"

    def status(self, batch_id):
        return "ended"

    def results(self, batch_id):
        answers = self.rounds[int(batch_id.split("_")[1]) - 1]
        for cid, text in answers.items():
            if text is None:
                yield cid, "errored", "overloaded_error", None
            else:
                yield cid, "succeeded", text if isinstance(text, str) else json.dumps(text), "end_turn"


def test_no_key_means_a_plan_made_by_rules_that_passes(tmp_path, monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_AUTH_TOKEN", raising=False)
    conn = db.connect(tmp_path / "n.db")
    got = planner.plan_stories(conn, CFG, "2026-11-15", [STORY], "now")[STORY["id"]]
    assert got["source"] == "rules" and got["status"] == "ok" and got["checks"] == [] and "no API key" in got["note"]
    kinds = [s["template"] for s in got["plan"]["scenes"]]
    assert kinds == ["kinetic_type", "object", "end_card"]
    assert got["plan"]["scenes"][1]["object"] == "datacenter"          # picked from the story's words: "zone"? no: "cloud"


def test_the_rules_plan_passes_for_real_feed_stories():
    """Real Techmeme-style items: one long sentence, a byline, the headline repeated in the summary, no summary at all."""
    cat = library.catalogue()
    for it in json.loads((FIX / "real_stories.json").read_text()):
        p = planner.rules_plan(it, cat)
        assert planner.check(p, it, planner.sources_for(it), cat, CFG, rules=True) == [], it["id"]
        kin = p["scenes"][0]["lines"]
        assert 1 <= len(kin) <= 5 and all("Wired" not in l["text"] and "Times)" not in l["text"] for l in kin)
        assert p["scenes"][1]["object"] not in planner.NOT_FOR_RULES
    r2 = planner.rules_plan(json.loads((FIX / "real_stories.json").read_text())[1], cat)
    assert {"text": "55%", "size": "xl"} in r2["scenes"][0]["lines"] and r2["scenes"][1]["object"] != "stock_line"   # a surge never gets a falling line


def test_a_failed_call_still_makes_a_video(tmp_path):
    class Down(Recorded):
        def submit(self, requests):
            raise ConnectionError("no network")
    conn = db.connect(tmp_path / "n.db")
    got = planner.plan_stories(conn, CFG, "d", [STORY], "now", client=Down())[STORY["id"]]
    assert got["source"] == "rules" and got["status"] == "ok" and "failed" in got["note"]
    got = planner.plan_stories(conn, CFG, "e", [STORY], "now", client=Recorded({STORY["id"]: None}))[STORY["id"]]
    assert got["source"] == "rules" and "errored" in got["note"]


def test_a_plan_that_fails_is_retried_once_with_the_errors(tmp_path):
    bad = good_plan()
    bad["scenes"][1]["narration"] = "It took 9 hours to fix."
    client = Recorded({STORY["id"]: bad}, {STORY["id"]: good_plan()})
    conn = db.connect(tmp_path / "n.db")
    got = planner.plan_stories(conn, CFG, "d", [STORY], "now", client=client)[STORY["id"]]
    assert got["status"] == "ok" and got["tries"] == 2 and got["source"] == "ai"
    retry = client.submitted[1][0]["params"]["messages"]
    assert retry[1]["role"] == "assistant" and "'9'" in retry[2]["content"]
    # the request: Haiku, the cached catalogue, the schema
    first = client.submitted[0][0]["params"]
    assert first["model"] == "claude-haiku-5-5" and first["system"][0]["cache_control"] == {"type": "ephemeral"}
    assert first["output_config"]["format"]["type"] == "json_schema" and "datacenter" in first["system"][0]["text"]


def test_a_plan_that_fails_twice_needs_review_and_gets_no_video(tmp_path):
    bad = good_plan()
    bad["scenes"][2]["quote"] = "Everything is fine"
    conn = db.connect(tmp_path / "n.db")
    issue = {"prime": [STORY], "cards": [], "glance": [], "generated_at": "x", "slots": {}}
    cfg = replace(CFG, funnel_video_count=1)
    renders = []
    stats = fi.build_issue(conn, cfg, "2026-11-15", issue, tmp_path, client=Recorded({STORY["id"]: bad}, {STORY["id"]: bad}),
                           speak=tone, render_fn=lambda *a, **k: renders.append(a))
    assert stats["needs_review"] == 1 and stats["passed"] == 0 and renders == []
    row = conn.execute("SELECT * FROM explainers").fetchone()
    assert row["status"] == "needs_review" and "word for word" in row["checks"]
    assert "video_url" not in json.loads((tmp_path / "issues/2026-11-15/feed.json").read_text())["prime"][0]


def test_someone_without_a_portrait_gets_initials_and_goes_on_the_list(tmp_path):
    fr = json.loads(subprocess.run(["node", "-e", "const l=require('./library/index.cjs');const f=l.frame({template:'handover',from:{name:'Ada Founder',role:'CEO'},to:{name:'Nia Chen'},narration:'x.'},l.THEMES[0],'9x16',{});process.stdout.write(JSON.stringify({html:f.html,missing:f.missing}))"],
                                   cwd=EXPL, capture_output=True, check=True).stdout)
    assert ">AF<" in fr["html"] and ">NC<" in fr["html"] and fr["missing"] == ["Ada Founder", "Nia Chen"]
    conn = db.connect(tmp_path / "n.db")
    eb.connect(conn)
    eb._save(conn, "2026-11-15", "s1", "now", missing=["Nia Chen"])
    eb._save(conn, "2026-11-14", "s2", "now", missing=["Nia Chen", "Ada Founder"])
    assert [(n["name"], n["stories"]) for n in eb.portraits_needed(conn)] == [("Nia Chen", 2), ("Ada Founder", 1)]


# ---------------------------------------------------------------- portraits

@pytest.mark.skipif(not shutil.which("potrace"), reason="potrace needed")
def test_a_portrait_is_traced_from_a_licensed_photo_and_credited(tmp_path):
    from PIL import Image, ImageDraw
    photo = tmp_path / "photo.png"
    im = Image.new("RGB", (400, 500), (235, 230, 220))
    d = ImageDraw.Draw(im)
    d.ellipse((110, 90, 290, 310), fill=(150, 120, 100)); d.ellipse((150, 160, 180, 190), fill=(20, 20, 20)); d.ellipse((220, 160, 250, 190), fill=(20, 20, 20))
    d.rectangle((90, 330, 310, 500), fill=(60, 60, 70))
    im.save(photo)
    with pytest.raises(ValueError, match="not allowed"):
        portraits.add(photo, "Jane Doe", "https://commons.wikimedia.org/wiki/File:Jane.jpg", "A. Photographer", "CC BY-NC 4.0", out_dir=tmp_path / "p")
    with pytest.raises(ValueError, match="not allowed"):
        portraits.add(photo, "Jane Doe", "https://commons.wikimedia.org/wiki/File:Jane.jpg", "A. Photographer", "All rights reserved", out_dir=tmp_path / "p")
    meta = portraits.add(photo, "Jane Doe", "https://commons.wikimedia.org/wiki/File:Jane.jpg", "A. Photographer", "CC BY-SA 4.0", out_dir=tmp_path / "p", aliases=["J. Doe"])
    svg = (tmp_path / "p" / "jane-doe.svg").read_text()
    assert meta["attribution"] == "Portrait traced from a photo by A. Photographer, CC BY-SA 4.0, Wikimedia Commons"
    assert 'class="pt-ink"' in svg and "fill=" not in svg and "#" not in svg          # coloured by the theme, nothing fixed
    js = ("const l=require('./library/index.cjs');l.reloadPortraits(process.argv[1]);"
          "const f=l.frame({template:'object',object:'avatar',person:{name:'J. Doe'},narration:'x.'},l.THEMES[0],'16x9',{});process.stdout.write(JSON.stringify({html:f.html,used:f.portraits.length,missing:f.missing}))")
    fr = json.loads(subprocess.run(["node", "-e", js, str(tmp_path / "p")], cwd=EXPL, capture_output=True, check=True).stdout)
    assert fr["used"] == 1 and fr["missing"] == [] and 'class="portrait"' in fr["html"] and "Portrait traced from a photo by A. Photographer" in fr["html"]


# ---------------------------------------------------------------- themes

def test_themes_follow_the_section_and_weekday_and_never_repeat_back_to_back():
    items = [{"id": str(i), "category": c} for i, c in enumerate(["AI", "AI", "AI", "Tech business", "Tech business", "Product launches", "Product launches", "AI"])]
    got = themes.choose(items, "2026-11-19", known=library.theme_ids())          # a Thursday: the Frontier edition
    seq = [got[str(i)] for i in range(len(items))]
    assert seq[0] == "frontier" and all(a != b for a, b in zip(seq, seq[1:]))
    assert seq[3] in themes.POOLS["Business"] and seq[5] in themes.POOLS["Launches"]
    assert themes.choose(items, "2026-11-19", known=library.theme_ids()) == got        # the same issue, the same looks
    friday = themes.choose(items[5:7], "2026-11-20", known=library.theme_ids())
    assert friday["5"] == "launch-day" and friday["6"] != "launch-day"
    assert themes.choose(items[:1], "2026-11-19", {"0": "orbit"}, known=library.theme_ids())["0"] == "orbit"   # the desk wins


# ---------------------------------------------------------------- voice, timing, captions

def tone(cfg, jobs, voice):
    """Stands in for Kokoro: a quiet tone per line, as long as the line would take to read."""
    for j in jobs:
        n = int(voicer.RATE * max(1.0, len(j["text"]) / 15))
        samples = b"".join(int(3000 * math.sin(2 * math.pi * 220 * k / voicer.RATE)).to_bytes(2, "little", signed=True) for k in range(n))
        with wave.open(j["out"], "wb") as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(voicer.RATE); w.writeframes(samples)


def test_each_line_is_its_own_clip_and_sets_the_timing_and_captions(tmp_path):
    v = voicer.make_voice(good_plan(), tmp_path, CFG, "af_heart", speak=tone)
    assert len(v["timing"]) == 5 and v["timing"][-1]["cues"] == [] and v["timing"][-1]["end"] - v["timing"][-1]["start"] == pytest.approx(voicer.END_CARD)
    assert all(a["end"] == pytest.approx(b["start"]) for a, b in zip(v["timing"], v["timing"][1:]))
    assert [c["text"] for c in v["cues"]][:2] == ["A power event hit zone B of a cloud region at 07:08.", "The errors did not stay there."]
    with wave.open(str(tmp_path / "voice.wav")) as w:
        assert w.getnframes() / w.getframerate() == pytest.approx(v["duration"], abs=0.05)
    vtt = voicer.vtt(v["cues"])
    assert vtt.startswith("WEBVTT\n\n1\n00:00:00.600 --> ") and "The errors did not stay there." in vtt


# ---------------------------------------------------------------- rendering

@needs_browser
@needs_ffmpeg
def test_the_same_plan_gives_the_same_frames(tmp_path):
    from pipeline.explainer import render as rd
    v = voicer.make_voice(good_plan(), tmp_path / "w", CFG, "af_heart", speak=tone)
    story = {"section": "Technology", "n": 3, "total": 50, "next": ["Next story"]}
    hashes = []
    for run in (1, 2):
        page = tmp_path / f"page{run}.html"
        rd.page({"plan": good_plan(), "theme": "map-room", "ratio": "16x9", "story": story, "timing": v["timing"]}, page)
        frames = tmp_path / f"f{run}"
        frames.mkdir()
        job = tmp_path / f"job{run}.json"
        job.write_text(json.dumps({"page": str(page), "ratio": "16x9", "fps": 30, "duration": v["duration"], "frames_dir": str(frames), "only_frames": [0, 20, 61, 140, 300, 420]}))
        subprocess.run(["node", str(EXPL / "render.cjs"), str(job)], check=True, cwd=EXPL, timeout=300)
        hashes.append([hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(frames.iterdir())])
    assert len(hashes[0]) == 6 and hashes[0] == hashes[1]
    assert len(set(hashes[0])) > 3                                   # and the frames do change over time


# ---------------------------------------------------------------- one full run

class Bucket:
    """A local stand-in for R2: keeps what is put, answers head like R2 does."""

    def __init__(self, root):
        self.root, self.puts = root, []

    def head(self, key):
        p = self.root / key
        return {"etag": hashlib.md5(p.read_bytes()).hexdigest()} if p.exists() else None

    def put_file(self, key, path, cache_control="", content_type=None):
        self.puts.append(key)
        (self.root / key).parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(path, self.root / key)


@needs_browser
@needs_ffmpeg
def test_one_full_run_from_source_to_the_paper_playing_it(tmp_path, monkeypatch):
    """source -> plan (recorded Haiku answer) -> checks -> voice -> render (both ratios) -> R2 stand-in -> publish -> the paper plays it."""
    date = "2026-11-15"
    public = tmp_path / "public"
    shutil.copytree(ROOT / "public", public, ignore=shutil.ignore_patterns("issues", "s", "share"))
    r2root = public / "r2"                                         # the bucket, served from the same test server
    port = _free_port()
    monkeypatch.setenv("R2_PUBLIC_URL", f"http://127.0.0.1:{port}/r2")
    conn = db.connect(tmp_path / "n.db")
    db_cfg = replace(CFG, funnel_video_count=1)
    issue = {"generated_at": "2026-11-15T05:00:00Z", "slots": {"prime": 1, "cards": 1, "glance": 1}, "prime": [STORY], "cards": [], "glance": [STORY], "issue": date}
    fi.write_feed(issue, tmp_path / "out" / "issues" / date / "issue.json")
    conn.execute("CREATE TABLE IF NOT EXISTS articles (id TEXT PRIMARY KEY, status TEXT, reject_reason TEXT)") if not conn.execute("SELECT 1 FROM sqlite_master WHERE name='articles'").fetchone() else None
    stats = fi.build_issue(conn, db_cfg, date, issue, tmp_path / "out", client=Recorded({STORY["id"]: RECORDED["text"]}), speak=tone)
    assert stats["passed"] == 1 and stats["ai_plans"] == 1, stats
    out = tmp_path / "out" / "issues" / date / "explainers" / STORY["id"]
    assert sorted(p.name for p in out.iterdir()) == ["16x9.jpg", "16x9.mp4", "9x16.jpg", "9x16.mp4", "captions.vtt", "plan.json"]
    row = conn.execute("SELECT * FROM explainers").fetchone()
    assert row["status"] == "rendered" and row["theme"] in library.theme_ids() and row["render_s"] > 0
    bucket = Bucket(r2root)
    res = fp.publish(SimpleNamespace(user_agent="t"), date, conn, 1, out_root=tmp_path / "out", public_root=public, fetch=lambda *a: False, build_share=True,
                     site=f"http://127.0.0.1:{port}", media=bucket)
    assert res["videos"] == 1 and f"issues/{date}/explainers/{STORY['id']}/16x9.mp4" in bucket.puts and f"issues/{date}/explainers/{STORY['id']}/captions.vtt" in bucket.puts
    page = json.loads((public / "issues" / date / "issue.json").read_text())
    lead = page["stories"][0]
    assert lead["reel"].split("?")[0].endswith("/9x16.mp4") and lead["cc"][0].startswith("A power event hit zone B")
    assert (public / "s" / STORY["id"] / "index.html").exists() and "1920" in (public / "s" / STORY["id"] / "index.html").read_text()
    sys.path.insert(0, str(ROOT))
    from serve_local import RangeHandler
    srv = ThreadingHTTPServer(("127.0.0.1", port), partial(RangeHandler, directory=str(public)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    try:
        run = subprocess.run(["node", str(FIX / "paper_plays.cjs"), f"http://127.0.0.1:{port}/", STORY["id"]], capture_output=True, timeout=120)
        assert run.returncode == 0, run.stderr.decode()[-1500:]
        got = json.loads(run.stdout)
    finally:
        srv.shutdown()
    assert got["src"].startswith(f"http://127.0.0.1:{port}/r2/issues/{date}/explainers/{STORY['id']}/16x9.mp4")
    assert got["played"] >= 0.5 and (got["width"], got["height"]) == (1920, 1080) and got["errors"] == []


def _free_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


# ---------------------------------------------------------------- the desk

from test_desk import env, web  # noqa: E402,F401  (pytest fixtures)


def test_the_desk_shows_the_library_and_a_story_and_takes_decisions(web):
    cookie = web.login()
    news = web.env.news
    eb.connect(news)
    date = "2026-11-05"
    plan = good_plan()
    eb._save(news, date, STORY["id"], "now", rank=0, headline=STORY["headline"], section="Technology", plan=plan, plan_source="ai", checks=[], status="rendered",
             theme="night-desk", missing=["Nia Chen"], duration_s=41.2, render_s=63.0)
    eb._save(news, date, "bad1", "now", rank=1, headline="A story whose plan failed", section="AI", plan=plan, plan_source="ai",
             checks=["scene 3: quote is not word for word in any source: 'x'"], status="needs_review")
    r = web.call("GET", f"/admin/explainers?date={date}&theme=orbit&ratio=16x9", cookie=cookie)
    assert r.status == 200 and "Explainers" in r.text and "44 drawings, 18 scene templates, 20 themes" in r.text
    assert "Portraits needed" in r.text and "Nia Chen" in r.text and "Needs review" in r.text and "t-orbit" in r.text and "v t-orbit tpl-" in r.text
    assert "<script" not in r.text                                    # the desk's CSP allows no inline script: the gallery needs none
    r = web.call("GET", f"/admin/explainers/story?date={date}&id=bad1", cookie=cookie)
    assert r.status == 200 and "The checks failed" in r.text and "not word for word" in r.text and "tpl-timeline" in r.text and "Re-render with this theme" in r.text
    r = web.call("POST", "/admin/explainers/decide", f"date={date}&id={STORY['id']}&decision=hold", cookie=cookie)
    assert r.status == 303 and news.execute("SELECT decision FROM explainers WHERE article_id=?", (STORY["id"],)).fetchone()[0] == "hold"
    r = web.call("POST", "/admin/explainers/decide", f"date={date}&id={STORY['id']}&decision=auto", cookie=cookie)
    assert news.execute("SELECT decision FROM explainers WHERE article_id=?", (STORY["id"],)).fetchone()[0] is None
    r = web.call("POST", "/admin/explainers/rerender", f"date={date}&id={STORY['id']}&theme=orbit", cookie=cookie)
    assert r.status == 303
    job = web.env.desk.execute("SELECT kind, issue FROM jobs ORDER BY id DESC LIMIT 1").fetchone()
    assert (job["kind"], job["issue"]) == ("explainer", f"{date} {STORY['id']} orbit")
    assert web.call("POST", "/admin/explainers/rerender", f"date={date}&id={STORY['id']}&theme=not-a-theme", cookie=cookie).status == 303
    assert web.call("GET", f"/admin/explainers/file?date={date}&id={STORY['id']}&name=../../news.db", cookie=cookie).status == 404
    assert web.call("GET", f"/admin/explainers?date={date}").status in (302, 303)          # signed out: no desk


def test_low_priority_wraps_heavy_commands():
    from pipeline.explainer import render as rd
    cmd, pre = rd.low(["node", "render.cjs"])
    assert cmd[-2:] == ["node", "render.cjs"] and callable(pre)
    if shutil.which("ionice"):
        assert cmd[:3] == ["ionice", "-c", "3"]


def test_renders_wait_for_reader_hours_unless_the_issue_is_due_soon(tmp_path, monkeypatch):
    from datetime import timedelta
    from pipeline import desk as dk
    monkeypatch.setenv("BOUGHT_DATA", str(tmp_path))
    desk = dk.connect(tmp_path / "desk.db")
    s = dk.get_settings(desk)
    due = dk.due_at("2026-11-15", s)
    t = [due - timedelta(days=1) + timedelta(minutes=30)]          # half an hour after yesterday's paper: reader hours
    waits = []
    sleep = lambda n: (waits.append(n), t.__setitem__(0, t[0] + timedelta(seconds=n)))
    waited = dk.wait_quiet(desk, "2026-11-15", now=lambda: t[0], sleep=sleep, busy=lambda: False, step=600)
    assert waited >= 3 * 3600 and t[0] >= due - timedelta(days=1) + timedelta(hours=int(s["reader_hours"]))
    t[0] = due - timedelta(hours=2)                                 # due in two hours: no waiting, whatever the load
    assert dk.wait_quiet(desk, "2026-11-15", now=lambda: t[0], sleep=sleep, busy=lambda: True) == 0
