"""Cloudflare R2: the signer, where published media goes, and the page's CSP. Nothing here talks to the network."""
import datetime as dt
import hashlib
import json
from types import SimpleNamespace

import pytest

from pipeline import r2
from pipeline import security as sec
from pipeline import share_pages
from pipeline.funnel import publish as fp
from pipeline.tests.test_publish import explainer_files, item

PUB = "https://media.bought.test"


def test_signer_matches_aws_published_get_object_example():
    # https://docs.aws.amazon.com/AmazonS3/latest/API/sig-v4-header-based-auth.html (GET Object, with a Range header)
    empty = hashlib.sha256(b"").hexdigest()
    h = r2.sign_headers("GET", "/test.txt", "", {"host": "examplebucket.s3.amazonaws.com", "range": "bytes=0-9"}, empty,
                        "AKIAIOSFODNN7EXAMPLE", "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY", "us-east-1",
                        dt.datetime(2013, 5, 24, tzinfo=dt.timezone.utc))
    assert h["authorization"] == ("AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, "
                                  "SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, "
                                  "Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41")


def test_without_every_key_r2_is_off_and_the_site_keeps_its_files(monkeypatch):
    for k in r2.KEYS:
        monkeypatch.delenv(k, raising=False)
    assert not r2.configured() and r2.store() is None
    with pytest.raises(r2.R2Error):
        r2.R2()


def test_local_env_file_never_overrides_the_environment(tmp_path, monkeypatch):
    env = tmp_path / ".env"
    env.write_text("# a comment\nR2_BUCKET=from-file\nR2_PUBLIC_URL='https://file.test'\nEMPTY=\nnot a line\n")
    monkeypatch.setenv("R2_BUCKET", "from-systemd")
    monkeypatch.delenv("R2_PUBLIC_URL", raising=False)
    r2.load_local_env(env)
    import os
    assert os.environ["R2_BUCKET"] == "from-systemd" and os.environ["R2_PUBLIC_URL"] == "https://file.test" and "EMPTY" not in os.environ
    r2.load_local_env(tmp_path / "missing.env")      # no file (the VPS): nothing happens


class FakeBucket:
    """Stands in for R2: keeps what was put, answers head with R2's ETag (the MD5 of a single PUT)."""
    def __init__(self):
        self.objects, self.puts = {}, []

    def head(self, key):
        b = self.objects.get(key)
        return None if b is None else {"size": len(b), "type": "", "etag": f'"{hashlib.md5(b).hexdigest()}"'}

    def put_file(self, key, path, cache_control="", content_type=None):
        self.objects[key] = path.read_bytes()
        self.puts.append(key)


def issue(tmp_path, with_podcast=True):
    base = tmp_path / "out" / "issues" / "2026-11-05"
    (base / "media").mkdir(parents=True)
    explainer_files(base)
    if with_podcast:
        (base / "media" / "podcast.mp3").write_bytes(b"mp3")
        (base / "media" / "podcast.json").write_text(json.dumps({"duration_s": 3, "chapters": []}))
    (base / "feed.json").write_text(json.dumps({"generated_at": "2026-11-05T06:52:43Z", "prime": [item(1, video=True), item(2, picture=True)], "cards": [], "glance": []}))
    return base


def fetch_picture(url, target, ua):
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(b"card")
    return True


def run(tmp_path, bucket):
    conn = SimpleNamespace(execute=lambda q, a=(): SimpleNamespace(fetchone=lambda: [0]))
    return fp.publish(SimpleNamespace(user_agent="t"), "2026-11-05", conn, 2, out_root=tmp_path / "out", public_root=tmp_path / "public",
                      fetch=fetch_picture, build_share=False, media=bucket)


def test_publish_puts_videos_posters_and_podcast_on_r2_and_points_readers_there(tmp_path, monkeypatch):
    monkeypatch.setenv("R2_PUBLIC_URL", PUB + "/")
    issue(tmp_path)
    pub = tmp_path / "public" / "issues" / "2026-11-05"
    (pub / "explainers" / "id1").mkdir(parents=True)
    (pub / "explainers" / "id1" / "16x9.mp4").write_bytes(b"an old local copy")
    bucket = FakeBucket()
    res = run(tmp_path, bucket)
    assert res["media"] == "r2"
    ex = "issues/2026-11-05/explainers/id1"
    assert sorted(bucket.puts) == sorted([f"{ex}/{n}" for n in ("16x9.mp4", "16x9.jpg", "9x16.mp4", "9x16.jpg", "captions.vtt", "plan.json")] + ["issues/2026-11-05/media/podcast.mp3"])
    page = json.loads((pub / "issue.json").read_text())
    lead = page["stories"][0]
    assert lead["video"].startswith(f"{PUB}/{ex}/16x9.mp4?v=") and lead["poster"].startswith(f"{PUB}/{ex}/16x9.jpg?v=")
    assert lead["reel"].startswith(f"{PUB}/{ex}/9x16.mp4?v=") and lead["reel_poster"].startswith(f"{PUB}/{ex}/9x16.jpg?v=")
    assert page["podcast"]["audio_url"].startswith(PUB + "/issues/2026-11-05/media/podcast.mp3?v=")
    assert not (pub / "explainers" / "id1" / "16x9.mp4").exists(), "the site's copy goes: readers get it from R2"
    assert page["stories"][1]["picture"] == "issues/2026-11-05/media/id2.jpg" and (pub / "media" / "id2.jpg").exists(), "card pictures stay on the site"
    # a rerun uploads nothing that did not change; a changed file goes up again
    bucket.puts.clear()
    run(tmp_path, bucket)
    assert bucket.puts == []
    (tmp_path / "out/issues/2026-11-05/explainers/id1/16x9.mp4").write_bytes(b"a recut video")
    run(tmp_path, bucket)
    assert bucket.puts == [f"{ex}/16x9.mp4"]


def test_publish_without_r2_copies_media_into_the_site_as_before(tmp_path):
    issue(tmp_path)
    res = run(tmp_path, None)
    pub = tmp_path / "public" / "issues" / "2026-11-05"
    page = json.loads((pub / "issue.json").read_text())
    assert res["media"] == "site" and page["stories"][0]["video"].startswith("issues/2026-11-05/explainers/id1/16x9.mp4?v=")
    assert (pub / "explainers" / "id1" / "16x9.mp4").exists() and (pub / "media" / "podcast.mp3").exists()


def test_share_pages_link_the_video_wherever_it_lives():
    assert share_pages.video_address("https://bought.test", f"{PUB}/issues/d/media/a.mp4?v=1") == f"{PUB}/issues/d/media/a.mp4"
    assert share_pages.video_address("https://bought.test", "issues/d/media/a.mp4?v=1") == "https://bought.test/issues/d/media/a.mp4"


def test_csp_allows_the_bucket_and_nothing_that_is_not_a_plain_origin():
    acct = "a" * 32
    pub, store = sec.r2_origins({"R2_PUBLIC_URL": PUB + "/", "R2_ACCOUNT_ID": acct})
    assert pub == [PUB] and store == [f"https://{acct}.r2.cloudflarestorage.com"]
    csp = sec.site_csp("https://abc.supabase.co", True, r2=(pub, store))
    rules = dict(part.split(" ", 1) for part in csp.split("; ") if " " in part)
    assert PUB in rules["media-src"] and PUB in rules["img-src"] and store[0] in rules["media-src"] and store[0] in rules["connect-src"]
    assert store[0] in rules["img-src"] and "supabase" not in rules["img-src"]    # ad pictures come from R2, never Supabase Storage
    assert "mux" not in csp and "googleapis" not in csp
    for bad in ({"R2_PUBLIC_URL": "http://insecure.test"}, {"R2_PUBLIC_URL": "https://x.test; script-src *"}, {"R2_PUBLIC_URL": "https://x.test/path"},
                {"R2_ACCOUNT_ID": "not-an-account; x"}, {}):
        assert sec.r2_origins(bad) == ([], [])
    assert "r2" not in sec.site_csp(None, True, r2=([], []))
    # until advertising is connected (Supabase), the account's storage address is not published at all
    quiet = sec.site_csp(None, True, r2=(pub, store))
    assert store[0] not in quiet and PUB in quiet


def test_a_held_explainer_goes_out_without_its_video(tmp_path, monkeypatch):
    import sqlite3
    monkeypatch.setenv("R2_PUBLIC_URL", PUB)
    issue(tmp_path)
    conn = sqlite3.connect(":memory:")
    conn.execute("CREATE TABLE explainers (issue TEXT, article_id TEXT, decision TEXT)")
    conn.execute("CREATE TABLE articles (id TEXT, status TEXT, reject_reason TEXT)")
    conn.execute("INSERT INTO explainers VALUES ('2026-11-05', 'id1', 'hold')")
    bucket = FakeBucket()
    fp.publish(SimpleNamespace(user_agent="t"), "2026-11-05", conn, 2, out_root=tmp_path / "out", public_root=tmp_path / "public", fetch=fetch_picture, build_share=False, media=bucket)
    page = json.loads((tmp_path / "public/issues/2026-11-05/issue.json").read_text())
    assert not page["stories"][0].get("video") and not page["clips"] and not any("explainers" in k for k in bucket.puts)
