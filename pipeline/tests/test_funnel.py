import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

import pytest

from pipeline import db
from pipeline.config import Config, Source, load_config
from pipeline.funnel import evaluate as ev
from pipeline.funnel.brief import load_brief
from pipeline.ingest import parse_tldr
from pipeline.funnel import images as im
from pipeline.funnel import issue as fi
from pipeline.funnel.contracts import CATEGORIES, Assessment, Candidate, ContractError, ImageAsset, assessment_schema
from pipeline.scoring import pick_sections, select

GOOD = {"article_id": "a", "decision": "keep", "relevance": 0.7, "category": "AI", "reason": "ok"}
NOW = datetime(2026, 11, 4, 12, tzinfo=timezone.utc)
CFG = Config()
BRIEF = load_brief()


@pytest.mark.parametrize("change", [
    {"headline": "model wrote this"},                 # no field may carry reader-facing text
    {"decision": "boost"}, {"relevance": 1.5}, {"relevance": -0.1}, {"relevance": True}, {"relevance": float("nan")}, {"relevance": "0.5"},
    {"category": "Sports"}, {"reason": "x" * 201}, {"reason": None}, {"article_id": "not-in-the-batch"},
])
def test_assessment_refuses_anything_off_contract(change):
    with pytest.raises(ContractError):
        Assessment.parse({**GOOD, **change}, ["a"])


def test_assessment_needs_every_field_and_schema_matches():
    assert Assessment.parse(GOOD, ["a"]).relevance == 0.7
    bad = dict(GOOD); del bad["reason"]
    with pytest.raises(ContractError):
        Assessment.parse(bad, ["a"])
    item = assessment_schema()["properties"]["assessments"]["items"]
    assert set(item["required"]) == set(GOOD) == set(item["properties"]) and item["additionalProperties"] is False
    assert set(item["properties"]["category"]["enum"]) == {*CATEGORIES, None}


def cand(headline, summary="", category="Technology", id_="a"):
    return Candidate(id_, headline, summary, "S", category, "2026-11-04T10:00:00Z")


@pytest.mark.parametrize("headline,summary", [
    ("Best laptop deals of the week", ""), ("TechCrunch Founder Summit 2026: Doors open at 9", ""),
    ("The Download: meat and sight", ""), ("Thing", "This is today's edition of The Download, our weekday newsletter"),
])
def test_rules_drop_what_is_not_news(headline, summary):
    assert ev.RuleEvaluator(BRIEF).assess([cand(headline, summary)])[0].decision == "drop"


@pytest.mark.parametrize("headline,category,want", [
    ("US tightens export controls on Taiwan", "AI", "Tech geopolitics"), ("Fal raises $200M in a Series C", "Technology", "Founders & startups"),
    ("Canva announces layoffs after earnings", "Technology", "Tech business"), ("Anthropic ships a new Claude model", "Technology", "AI"),
    ("Sony unveils a new camera", "Technology", "Product launches"), ("Why batteries degrade", "AI", "Technology"),
])
def test_keywords_file_a_story(headline, category, want):
    a = ev.RuleEvaluator(BRIEF).assess([cand(headline, category=category)])[0]
    assert (a.decision, a.category) == ("keep", want)


def test_off_brief_is_dropped_unless_the_whole_source_is_on_brief():
    c = Candidate("a", "Hira: your personal helper", "", "Product Hunt", "Product launches", "t")
    assert ev.RuleEvaluator(BRIEF).assess([c])[0].reason == "off brief"
    a = ev.RuleEvaluator(BRIEF, {"Product Hunt"}).assess([c])[0]
    assert (a.decision, a.category) == ("keep", "Product launches")


def test_keywords_respect_capitals():
    assert "AI" not in BRIEF.hits("Aid is on the way, said Ai", "")     # AI is a capitals keyword
    assert "AI" in BRIEF.hits("AI is everywhere", "")


def test_tldr_page_gives_titles_and_links_without_sponsors_or_blurbs():
    html = b"""<article><a href="https://ad.example/x"><h3>Buy this tool (Sponsor)</h3></a><div>ad</div></article>
    <article><a class="b" href="https://site.example/story?utm_source=tldr"><h3>OpenAI ships a thing (4 minute read)</h3></a><div class="newsletter-html">TLDR's own words</div></article>"""
    got = parse_tldr(html, NOW)
    assert [(i.title, i.link, i.summary) for i in got] == [("OpenAI ships a thing", "https://site.example/story?utm_source=tldr", "")]


def store(tmp_path, stories):
    conn = db.connect(tmp_path / "n.db")
    for i, (title, cat, weight) in enumerate(stories):
        conn.execute("INSERT INTO articles (id,canonical_url,source,category,source_weight,title,summary,published_at,fetched_at)"
                     " VALUES (?,?,?,?,?,?,?,?,?)", (f"{i:016x}", f"https://x/{i}", "S", cat, weight, title, "A summary.", "2026-11-04T10:00:00Z", "2026-11-04T10:00:00Z"))
    return conn


class Fake:
    name, version = "fake", "1"

    def __init__(self, answer):
        self.answer, self.calls = answer, 0

    def assess(self, cands):
        self.calls += 1
        return self.answer(cands)


def test_model_cannot_bring_back_a_rule_drop_and_is_asked_once(tmp_path):
    conn = store(tmp_path, [("Best phone deals of the week", "Technology", 3), ("Chip plant opens", "Technology", 3)])
    model = Fake(lambda cs: [Assessment(c.id, "keep", 0.9, None, "") for c in cs])
    rel = ev.consider(conn, CFG, "t", BRIEF, model=model)
    rows = {r["title"]: r for r in conn.execute("SELECT * FROM articles")}
    assert rows["Best phone deals of the week"]["status"] == "rejected"
    assert list(rel) == [rows["Chip plant opens"]["id"]]
    ev.consider(conn, CFG, "t", BRIEF, model=model)
    assert model.calls == 1


def test_broken_model_leaves_the_rules_standing(tmp_path):
    conn = store(tmp_path, [("Chip plant opens", "Technology", 3)])
    def boom(_):
        raise ContractError("garbage")
    assert ev.consider(conn, CFG, "t", BRIEF, model=Fake(boom)) == {}
    assert conn.execute("SELECT status FROM articles").fetchone()[0] == "new"


@pytest.mark.parametrize("reply", ['not json', '{"assessments": [{"article_id": "a"}]}', '{"assessments": []}', '[]', '{"assessments": [], "note": 1}'])
def test_command_evaluator_refuses_bad_replies(tmp_path, reply):
    prog = tmp_path / "m.py"
    prog.write_text(f"import sys; sys.stdin.read(); print({reply!r})")
    import sys
    with pytest.raises(ContractError):
        ev.CommandEvaluator([sys.executable, str(prog)]).assess([cand("x")])


def test_command_evaluator_gets_the_schema_and_a_good_reply_passes(tmp_path):
    prog = tmp_path / "m.py"
    prog.write_text("import json,sys; d=json.load(sys.stdin); assert 'schema' in d;"
                    "print(json.dumps({'assessments':[{'article_id':c['id'],'decision':'drop','relevance':0.1,'category':None,'reason':'off topic'} for c in d['candidates']]}))")
    import sys
    assert ev.CommandEvaluator([sys.executable, str(prog)]).assess([cand("x")])[0].decision == "drop"


def test_jev_finalises_the_list_and_the_section(tmp_path):
    conn = store(tmp_path, [("AI one from a strong source", "AI", 5), ("AI two", "AI", 1), ("AI three", "AI", 1), ("AI not really news", "AI", 5)])
    ids = {r["title"]: r["id"] for r in conn.execute("SELECT id, title FROM articles")}
    def answer(cs):
        out = []
        for c in cs:
            if "not really" in c.headline:
                out.append(Assessment(c.id, "drop", 0.0, None, "not news for Bought"))
            elif "three" in c.headline:
                out.append(Assessment(c.id, "keep", 0.9, "Tech business", ""))
            else:
                out.append(Assessment(c.id, "keep", 0.2 if "strong" in c.headline else 0.8, None, ""))
        return out
    rel = ev.consider(conn, CFG, "t", BRIEF, model=Fake(answer))
    select(conn, CFG, NOW, relevance=rel, sections={"AI": 1, "Tech business": 1})
    picked = {r["title"]: r["category"] for r in conn.execute("SELECT a.title, a.category FROM selections s JOIN articles a ON a.id=s.article_id")}
    assert picked == {"AI two": "AI", "AI three": "Tech business"}    # its ranking beat the stronger source; its section stood
    assert conn.execute("SELECT status FROM articles WHERE id=?", (ids["AI not really news"],)).fetchone()[0] == "rejected"


def test_jev_is_shown_the_brief_and_the_link(tmp_path):
    import sys
    prog = tmp_path / "m.py"
    prog.write_text("import json,sys; d=json.load(sys.stdin); assert d['brief']['sections'][0]['name'] and d['candidates'][0]['link'] == 'https://x/1';"
                    "print(json.dumps({'assessments':[{'article_id':c['id'],'decision':'keep','relevance':0.5,'category':None,'reason':''} for c in d['candidates']]}))")
    c = Candidate("a", "x", "", "S", "AI", "t", "https://x/1")
    assert ev.CommandEvaluator([sys.executable, str(prog)], brief=BRIEF).assess([c])


def test_selection_ignores_anything_after_the_issue_date(tmp_path):
    conn = store(tmp_path, [("AI story", "AI", 3)])
    conn.execute("UPDATE articles SET published_at='2026-11-09T00:00:00Z'")
    assert select(conn, CFG, NOW, sections={"AI": 1})["candidates"] == 0


def test_article_page_is_read_once_for_picture_and_missing_summary(tmp_path):
    conn = store(tmp_path, [("AI one", "AI", 3), ("AI two", "AI", 3)])
    conn.execute("UPDATE articles SET summary='' WHERE title='AI one'")
    select(conn, CFG, NOW, sections={"AI": 2})
    calls = []
    class F:
        def page_meta(self, url):
            calls.append(url)
            return "What the publisher wrote. More. Even more.", "https://pub/big.jpg"
    assert fi.describe_selected(conn, F()) == 2
    one, two = (conn.execute("SELECT summary, image_url FROM articles WHERE title=?", (t,)).fetchone() for t in ("AI one", "AI two"))
    assert one["summary"] == "What the publisher wrote. More." and one["image_url"] == "https://pub/big.jpg"
    assert two["summary"] == "A summary." and two["image_url"] == "https://pub/big.jpg"
    fi.describe_selected(conn, F())
    assert len(calls) == 2


def test_sections_fill_to_size_never_pad_and_deal_in_turn():
    cands = [{"id": f"t{i}", "category": "Technology", "score": 10 - i, "published_at": "x"} for i in range(4)] + [{"id": "g", "category": "Geo", "score": 1, "published_at": "x"}]
    assert [c["id"] for c in pick_sections(cands, {"Technology": 2, "Geo": 5, "Empty": 3})] == ["t0", "g", "t1"]


@pytest.mark.parametrize("headline,summary,want", [
    ("Anthropic is working on a system", "", ["Anthropic"]), ("Rian Johnson explains why he built an app", "", ["Rian Johnson"]),
    ("Not even $200 million could help Elon Musk buy Texas", "", ["Elon Musk", "Texas"]), ("Doors open at 9 a.m. ET", "", ["Doors"]), ("Canva is announcing layoffs", "", ["Canva"]),
    ("Why Everyone Is Buying Chips Now", "Nothing proper here.", []), ("Why Everyone Is Buying Nvidia Chips", "", ["Nvidia"]),
])
def test_names_in(headline, summary, want):
    assert im.names_in(headline, summary) == want


def page(title, license_="cc-by-sa-4.0", short="CC BY-SA 4.0", w=2000, h=1200, mime="image/jpeg", artist="Jo", repo="shared", attr="true"):
    return {"title": f"File:{title}.jpg", "imagerepository": repo, "imageinfo": [{"mime": mime, "width": w, "height": h, "url": f"https://x/{title}", "descriptionurl": f"https://x/p/{title}",
            "extmetadata": {"License": {"value": license_}, "LicenseShortName": {"value": short}, "Artist": {"value": f"<a>{artist}</a>"}, "AttributionRequired": {"value": attr}}}]}


@pytest.mark.parametrize("bad", [
    page("Nvidia HQ", "cc-by-nc-4.0", "CC BY-NC 4.0"), page("Nvidia HQ", "fair use", "Fair use"), page("Nvidia HQ", "", ""), page("Nvidia HQ", artist=""),
    page("Nvidia logo"), page("Some village"), page("Nvidia HQ", w=500, h=300), page("Nvidia HQ", w=1000, h=1600), page("Nvidia HQ", mime="image/svg+xml"), page("Nvidia HQ", repo="local"),
])
def test_a_picture_without_clear_rights_or_fit_is_refused(bad):
    assert im.commons_candidates([bad], "Nvidia", CFG, 2026) == []


def test_free_pictures_pass_best_first():
    got = im.commons_candidates([page("Nvidia small", w=1100, h=800), page("Nvidia HQ", "pd", "Public domain", attr="false", artist="")], "Nvidia", CFG, 2026)
    assert [c["title"] for c in got] == ["Nvidia HQ", "Nvidia small"]


def test_an_article_picture_must_be_tied_to_the_subject():
    about = page("Dario portrait", w=800, h=1100)
    about["imageinfo"][0]["extmetadata"]["ImageDescription"] = {"value": "Dario, CEO of Anthropic"}
    assert im.commons_candidates([about], "Anthropic", CFG, 2026, need_name=False)
    assert im.commons_candidates([page("Berlaymont building")], "Google", CFG, 2026, need_name=False) == []     # merely on the article's page
    tied = [c["title"] for c in im.commons_candidates([page("Trump at desk"), page("Elon Musk talk")], "Elon Musk", CFG, 2026, need_name=False)]
    assert tied == ["Elon Musk talk"]


def test_a_page_of_white_is_not_a_photo():
    from PIL import Image
    assert im.looks_like_a_page(Image.new("RGB", (640, 360), (255, 255, 255)))
    assert not im.looks_like_a_page(Image.new("RGB", (640, 360), (90, 70, 60)))


def asset(provider="commons", license_="CC BY-SA 4.0", path="/x.jpg"):
    return ImageAsset(provider, "https://x/a", "https://x/p", "T", "Jo", license_, "", path, 1600, 900, "0" * 16)


def test_credit_says_who_and_what():
    assert asset().credit == "File photo: Jo · CC BY-SA 4.0 · Wikimedia Commons"
    assert asset("library").credit == ""


def issue_with(n):
    item = lambda i: {"id": f"{i:016x}", "headline": f"Story {i}", "summary": "S.", "source": "Src", "category": "AI", "link": "https://x", "image_url": "https://pub/p.jpg", "image_credit": "Pub",
                      "published_at": "2026-11-04T10:00:00Z", "script": f"Script {i}."}
    return {"generated_at": "x", "slots": {}, "prime": [item(i) for i in range(n)], "cards": [item(50)], "glance": []}


class Src:
    def __init__(self, assets=None, error=None):
        self.assets, self.error, self.calls = assets or [asset()], error, 0

    def for_story(self, item, use_publisher=False):
        self.calls += 1
        if self.error:
            raise self.error
        return self.assets


def fake_synth(text, out, cfg, voice=""):
    Path(out).write_bytes(b"not audio")


@pytest.fixture
def media_stubs(monkeypatch):
    monkeypatch.setattr(fi, "make_voice", lambda item, voice, wav, cfg, synth: (wav.write_bytes(b"w"), 10.0)[1])
    monkeypatch.setattr(fi, "gate", lambda *a: None)


def fake_render(spec_path):
    s = json.loads(Path(spec_path).read_text())
    Path(s["out"]).write_bytes(b"v")
    Path(s["poster"]).write_bytes(b"p")


def test_build_feeds_only_what_passed_and_skips_finished_work(tmp_path, media_stubs):
    conn = db.connect(tmp_path / "n.db")
    src, renders = Src(), []
    render = lambda p: (renders.append(p), fake_render(p))
    issue = issue_with(2)
    assert fi.build_issue(conn, CFG, "2026-11-04", issue, tmp_path, src, renderer=render)["passed"] == 2
    feed = json.loads((tmp_path / "issues/2026-11-04/feed.json").read_text())
    assert feed["prime"][0]["video_url"].startswith("media/") and feed["prime"][0]["images"][0]["credit"]
    assert "video_url" not in feed["cards"][0]
    spec = json.loads(Path(renders[0]).read_text())
    assert len(spec["images"]) == 2 and spec["credits"][0]               # one picture is shown twice so the cross-fade has a partner
    fi.build_issue(conn, CFG, "2026-11-04", issue, tmp_path, src, renderer=render)
    assert len(renders) == 2 and src.calls == 2


def test_a_failed_render_is_left_out_and_retried_up_to_the_limit(tmp_path, media_stubs):
    conn = db.connect(tmp_path / "n.db")
    calls = []
    def broken(p):
        calls.append(p)
        raise RuntimeError("no")
    issue = issue_with(1)
    for _ in range(CFG.media_max_attempts + 2):
        stats = fi.build_issue(conn, CFG, "d", issue, tmp_path, Src(), renderer=broken)
    assert stats["failed"] == 1 and len(calls) == CFG.media_max_attempts
    assert "video_url" not in json.loads((tmp_path / "issues/d/feed.json").read_text())["prime"][0]


def test_picture_service_down_means_retry_not_stand_ins(tmp_path, media_stubs):
    conn = db.connect(tmp_path / "n.db")
    stats = fi.build_issue(conn, CFG, "d", issue_with(1), tmp_path, Src(error=im.SourcingError("down")), renderer=fake_render)
    assert stats["failed"] == 1 and stats["library"] == 0
    stats = fi.build_issue(conn, CFG, "d", issue_with(1), tmp_path, Src(), renderer=fake_render)
    assert stats["passed"] == 1


def test_an_issue_is_frozen_and_keeps_publisher_pictures_unless_told_not_to(tmp_path):
    conn = store(tmp_path, [("A", "AI", 3)])
    conn.execute("UPDATE articles SET image_url='https://pub/p.jpg', image_credit='Pub'")
    select(conn, CFG, NOW, sections={"AI": 1})
    src = [Source("S", "rss", "https://x", 3, "AI")]
    one = fi.cut_issue(conn, CFG, "d", NOW, src, tmp_path)
    assert one["prime"][0]["image_url"] == "https://pub/p.jpg"
    conn.execute("UPDATE articles SET title='Changed'")
    assert fi.cut_issue(conn, CFG, "d", NOW, src, tmp_path)["prime"][0]["headline"] == "A"
    assert fi.cut_issue(conn, CFG, "d", NOW, src, tmp_path, recut=True)["prime"][0]["headline"] == "Changed"
    objecting = [Source("S", "rss", "https://x", 3, "AI", image_rights="link_only")]
    assert fi.cut_issue(conn, CFG, "e", NOW, objecting, tmp_path)["prime"][0]["image_url"] is None


def test_uncleared_publisher_pictures_are_listed_for_the_legal_work(tmp_path, media_stubs):
    conn = db.connect(tmp_path / "n.db")
    pub = ImageAsset("publisher", "https://pub/p.jpg", "https://pub/story", "T", "pub.com", "Not cleared", "", "/x.jpg", 1600, 900, "0" * 16)
    assert pub.credit == "Photo: pub.com"
    assert fi.build_issue(conn, CFG, "d", issue_with(1), tmp_path, Src([pub]), renderer=fake_render)["publisher"] == 1
    listed = json.loads((tmp_path / "issues/d/rights_review.json").read_text())["pictures"]
    assert [(p["picture"], p["article"]) for p in listed] == [("https://pub/p.jpg", "https://pub/story")]


def test_the_publisher_picture_goes_first(tmp_path):
    from PIL import Image
    s = im.Sourcer(CFG, tmp_path / "c", pause=0)
    pub = ImageAsset("publisher", "u", "p", "T", "a", "Not cleared", "", "/x.jpg", 1600, 900, "0" * 16)
    s._download = lambda url, meta, provider: pub
    s.resolve = lambda names, topics: []
    item = {"id": "a" * 16, "headline": "Nothing named here", "summary": "", "link": "https://pub.com/s", "source": "S", "image_url": "https://pub.com/p.jpg", "category": "AI"}
    assert s.for_story(item, use_publisher=True)[0].provider == "publisher"
    assert all(a.provider == "library" for a in s.for_story(item, use_publisher=False))


def test_gate_refuses_a_bad_licence_or_no_pictures(tmp_path):
    with pytest.raises(ValueError, match="licence"):
        fi.gate("x", "x", 1, [asset(license_="All rights reserved")], CFG)
    with pytest.raises(ValueError, match="no pictures"):
        fi.gate("x", "x", 1, [], CFG)


def test_no_model_is_needed_by_default():
    assert load_config().funnel_evaluator_command == () and ev.build_model(load_config()) is None


def test_a_clip_is_cut_from_a_free_video_and_credited(tmp_path):
    import subprocess
    src = tmp_path / "in.webm"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc=size=1280x720:rate=25:duration=9", "-c:v", "libvpx", "-b:v", "500k", str(src)], check=True)
    s = im.Sourcer(CFG, tmp_path / "c", pause=0)
    a = s._clip({"url": str(src), "page_url": "https://x/p", "title": "Nvidia plant", "author": "Jo", "license": "CC BY 3.0", "license_url": "", "duration": 9.0})
    assert a.frames >= 100 and a.credit.startswith("File video: Jo") and Path(a.path, "0001.jpg").exists()


def test_a_video_needs_rights_and_length_too():
    good = page("Nvidia plant tour", mime="video/webm"); good["imageinfo"][0]["duration"] = 60
    short = page("Nvidia plant tour", mime="video/webm"); short["imageinfo"][0]["duration"] = 3
    unfree = page("Nvidia plant tour", "cc-by-nc-4.0", "CC BY-NC 4.0", mime="video/webm"); unfree["imageinfo"][0]["duration"] = 60
    assert im.commons_candidates([good], "Nvidia", CFG, 2026, clips=True)
    assert not im.commons_candidates([short, unfree], "Nvidia", CFG, 2026, clips=True)
