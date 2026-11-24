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
from pipeline.funnel import issue as fi
from pipeline.funnel.contracts import CATEGORIES, Assessment, Candidate, ContractError, assessment_schema
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


def issue_with(n):
    item = lambda i: {"id": f"{i:016x}", "headline": f"Story {i}", "summary": "S.", "source": "Src", "category": "AI", "link": "https://x", "image_url": "https://pub/p.jpg", "image_credit": "Pub",
                      "published_at": "2026-11-04T10:00:00Z", "script": f"Script {i}."}
    return {"generated_at": "x", "slots": {}, "prime": [item(i) for i in range(n)], "cards": [item(50)], "glance": []}


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


def test_no_model_is_needed_by_default():
    assert load_config().funnel_evaluator_command == () and ev.build_model(load_config()) is None


def test_config_commands_follow_bought_home_so_one_file_fits_every_machine(monkeypatch):
    from pipeline.config import expand_arg
    monkeypatch.setenv("BOUGHT_HOME", "/srv/bought/models")
    assert expand_arg("$BOUGHT_HOME/tts/venv/bin/python") == "/srv/bought/models/tts/venv/bin/python"
    assert expand_arg("${BOUGHT_HOME}/m2m100_ct2") == "/srv/bought/models/m2m100_ct2"
    assert expand_arg("{wav}") == "{wav}" and expand_arg("$NOT_SET_ANYWHERE/x") == "$NOT_SET_ANYWHERE/x"
    monkeypatch.delenv("BOUGHT_HOME")
    assert expand_arg("$BOUGHT_HOME/tts").endswith("/.cache/bought/tts") and not expand_arg("~/x").startswith("~")
