import json
from pathlib import Path
from types import SimpleNamespace

from pipeline.funnel import publish as fp


def item(i, category="AI", video=False, picture=False, headline=None, summary="A summary of the story that is long enough to keep."):
    it = {"id": f"id{i}", "headline": headline or f"Story number {i}", "summary": summary, "source": "Techmeme", "category": category, "link": f"https://x.test/{i}",
          "image_url": None, "image_credit": None, "published_at": "2026-11-05T06:45:00Z"}
    if video:
        it.update(video_url=f"media/id{i}.mp4", poster_url=f"media/id{i}.jpg", image_url=f"media/id{i}.jpg", duration_s=40.1)
    if picture:
        it.update(image_url=f"https://x.test/{i}.jpg", image_credit="Wired")
    return it


def test_headline_credit_and_sources():
    assert fp.clean_headline("Pro-AI PAC ends flat (Tess Owen/Wired)") == "Pro-AI PAC ends flat"
    assert fp.clean_headline("Sources: Microsoft rejects a deal") == "Microsoft rejects a deal, sources say"
    assert fp.clean_headline("Source: Meta drops fruit names (Charles Rollet/Business Insider)") == "Meta drops fruit names, a source says"
    assert fp.clean_headline("Xbox adds phones (XBOX Wire)", "Techmeme") == "Xbox adds phones"
    assert fp.clean_headline("Chips are back (again)", "The Verge") == "Chips are back (again)"
    assert fp.clean_headline("Sources and company memo: YMTC pauses IPO") == "Sources and company memo: YMTC pauses IPO"


def test_summary_loses_boilerplate_and_the_repeated_headline():
    head = "Pro-AI PAC ends flat (Tess Owen/Wired)"
    assert fp.clean_summary("Tess Owen / Wired: Pro-AI PAC ends flat — Leading the Future had a war chest of $100 million", head) == "Leading the Future had a war chest of $100 million"
    assert fp.clean_summary("Article URL: https://a.test Comments URL: https://b.test Points: 9", "Title") == ""
    assert fp.clean_summary("Build vs.", "Title") == ""
    long = "Microsoft rejects an option to more than double its Texas data center contract"
    assert fp.clean_summary(f"Financial Times: Sources: {long[:60]}…", "Sources: " + long) == ""
    assert fp.clean_summary("Tess Owen / Wired: Pro-AI PAC ends flat", head) == ""


def test_sentences_do_not_break_on_initials():
    assert fp.split_sentences("Glade Brook, Coatue, and T. Rowe Price were among the buyers.") == ["Glade Brook, Coatue, and T. Rowe Price were among the buyers."]
    assert len(fp.split_sentences("The company raised a large round on Tuesday morning. Investors include Coatue.")) == 2


def test_each_story_appears_once_even_though_the_feed_repeats_the_top():
    top = item(1, video=True)
    feed = {"prime": [top, item(2)], "cards": [item(3)], "glance": [top]}
    assert [i["id"] for i in fp.unique_items(feed)] == ["id1", "id2", "id3"]


def test_lead_is_the_first_story_with_a_video_and_a_video_is_never_a_brief():
    stories = [item(0)] + [item(i, video=True) for i in range(1, 3)] + [item(i, category="Tech business", video=i == 9) for i in range(3, 10)]
    out = fp.lay_out({"prime": stories, "cards": [], "glance": []})
    assert out[0][0]["id"] == "id1" and out[0][1] == "lead"
    assert [s for _, s in out[:4]] == ["lead", "top", "top", "top"]
    assert all(not (i.get("video_url") and s == "b") for i, s in out)
    assert len(out) == len({i["id"] for i, _ in out}) == 10


def test_publish_writes_the_issue_the_site_reads(tmp_path):
    base = tmp_path / "out" / "issues" / "2026-11-05"
    (base / "media").mkdir(parents=True)
    (base / "media" / "id1.mp4").write_bytes(b"v")
    (base / "media" / "id1.jpg").write_bytes(b"p")
    feed = {"generated_at": "2026-11-05T06:52:43Z", "prime": [item(1, video=True, headline="Acme raises $20M for robots"), item(2, picture=True), item(3)], "cards": [], "glance": []}
    (base / "feed.json").write_text(json.dumps(feed))
    (base / "rights_review.json").write_text(json.dumps({"note": "n", "pictures": []}))

    def fake_fetch(url, target, ua):
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(b"j")
        return True

    marked = []
    conn = SimpleNamespace(execute=lambda q, a=(): marked.append((q, a)) if q.startswith("UPDATE") else SimpleNamespace(fetchone=lambda: [0]))
    pub = tmp_path / "public"
    res = fp.publish(SimpleNamespace(user_agent="t"), "2026-11-05", conn, 22, out_root=tmp_path / "out", public_root=pub, fetch=fake_fetch, build_share=False)
    assert res["stories"] == 3 and res["videos"] == 1 and res["pictures"] == 1
    assert len(marked) == 3 and all("status='used'" in q and a[0] == "issue:2026-11-05" for q, a in marked)   # they can't run again tomorrow
    page = json.loads((pub / "issues/2026-11-05/issue.json").read_text())
    lead = page["stories"][0]
    assert lead["sz"] == "lead" and lead["video"].startswith("issues/2026-11-05/media/id1.mp4") and (pub / "issues/2026-11-05/media/id1.mp4").exists()
    assert page["stories"][1]["media"] == "pic" and page["stories"][1]["picture"].endswith("id2.jpg")
    assert page["stories"][2]["media"] == "none"
    assert page["nums"][0][0] == "$20M" and page["nums"][0][2] == 0
    assert "pulse" in page["polls"] and 0 in {int(k) for k in page["polls"] if k != "pulse"}
    assert json.loads((pub / "issues/index.json").read_text()) == {"latest": "2026-11-05", "dates": ["2026-11-05"]}
    # the legal list includes the picture shown on the card
    assert json.loads((base / "rights_review.json").read_text())["card_pictures"][0]["article_id"] == "id2"


def test_a_picture_that_cannot_be_fetched_is_left_out(tmp_path):
    base = tmp_path / "out" / "issues" / "2026-11-05"
    base.mkdir(parents=True)
    (base / "feed.json").write_text(json.dumps({"prime": [item(2, picture=True)], "cards": [], "glance": []}))
    conn = SimpleNamespace(execute=lambda q, a=(): SimpleNamespace(fetchone=lambda: [0]))
    fp.publish(SimpleNamespace(user_agent="t"), "2026-11-05", conn, 1, out_root=tmp_path / "out", public_root=tmp_path / "pub", fetch=lambda *a: False, build_share=False)
    assert json.loads((tmp_path / "pub/issues/2026-11-05/issue.json").read_text())["stories"][0]["media"] == "none"


def test_a_language_that_invents_or_copies_is_refused():
    items = [item(i, headline=f"Acme raises ${i}0M in new round of funding") for i in range(1, 11)]
    good = {f"id{i}": {"headline": f"एक्मे ने ${i}0M जुटाए"} for i in range(1, 11)}
    assert fp.language_ok(items, good)
    invented = {f"id{i}": {"headline": "ಕಲಬುರಗಿ ಸ 11 ಅಕ್ಟೋಬರ್ 2"} for i in range(1, 11)}
    assert not fp.language_ok(items, invented)
    copied = {f"id{i}": {"headline": f"Acme raises ${i}0M in new round of funding"} for i in range(1, 11)}
    assert not fp.language_ok(items, copied)
    assert not fp.language_ok(items, {})


def test_captions_follow_the_script_in_short_pieces():
    script = "AI. " + "word " * 40 + "ends here. Source: Techmeme."
    parts = fp.captions(script)
    assert parts[0] == "AI." and parts[-1] == "Source: Techmeme."
    assert all(len(p) <= 78 for p in parts)
    assert " ".join(parts) == " ".join(script.split())
    assert fp.captions("") == []
