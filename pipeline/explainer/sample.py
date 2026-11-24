"""A sample explainer from the library's own placeholder story, start to finish without the AI: for trying a theme and
for timing the renderer on a machine (python -m pipeline explainer sample --theme night-desk --out /tmp/sample)."""
from __future__ import annotations

import json
import time
import wave
from pathlib import Path

from . import render as renderer, voice as voicer

PLAN = {"story_id": "sample", "section": "Technology", "duration_target_s": 60, "scenes": [
    {"template": "object", "object": "datacenter", "highlight": ["zoneB"], "arrows": [["zoneB", "zoneA"], ["zoneB", "zoneC"]],
     "card": {"title": "Cloud region · Tuesday", "quote": "a power event in one zone", "highlight": "one zone", "source": "Provider status page"},
     "narration": "A power fault hit one zone of a cloud region at 7:08 in the morning. Zones are built so one failure stays inside its own walls."},
    {"template": "timeline", "events": [["07:08", "Fault begins, zone B"], ["07:35", "First customer reports"], ["09:35", "First public update"], ["15:00", "Fixed"]],
     "big": "7 h 52 min", "narration": "Customers noticed within half an hour. The first public update came at 9:35. It took until 3 p.m. to fix."},
    {"template": "source_quote", "quote": "Some services in the region may see elevated errors.", "highlight": "elevated errors", "source": "Provider status page · 09:35",
     "chips": ["zone A", "zone B", "zone C"], "narration": "But the fault didn't stay in one zone. Services in the other zones saw errors too."},
    {"template": "network_spread", "state": "spread", "label": "40 companies", "narration": "Apps built on the region went down with it. At least 40 companies reported trouble."},
    {"template": "checklist", "items": ["Spread across regions", "Test the failover", "Watch the status page"], "narration": "Engineers say three habits limit the damage. None of them are new."},
    {"template": "end_card"}]}


def silent(cfg, jobs, voice):
    """No Kokoro: a silent clip per line, as long as a calm reader would take (about 14 characters a second)."""
    for j in jobs:
        n = int(voicer.RATE * max(1.2, len(j["text"]) / 14))
        with wave.open(j["out"], "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(voicer.RATE)
            w.writeframes(bytes(2 * n))


def run(cfg, theme: str | None, out: str | None, real_voice=True, ratios=None) -> dict:
    out_dir = Path(out or "/tmp/bought-explainer-sample")
    work = out_dir / "work"
    t0 = time.monotonic()
    voiced = voicer.make_voice(PLAN, work, cfg, cfg.funnel_voices[0], speak=voicer.kokoro if real_voice else silent)
    bed = voicer.music_bed(Path(__file__).resolve().parents[1] / "data" / "explainer" / f"music-bed-{voicer.BED_VERSION}.wav")
    voicer.mix(work / "voice.wav", bed, work / "mix.wav", voiced["duration"], cfg.explainer_music_db)
    t1 = time.monotonic()
    story = {"section": "Technology", "n": 9, "total": 50, "next": ["Chipmakers race to build new plants", "A new law on AI starts today"]}
    timings = {}
    for ratio in ratios or cfg.explainer_ratios:
        t = time.monotonic()
        renderer.render(PLAN, theme or "night-desk", story, voiced, work / "mix.wav", out_dir, work, cfg, ratios=[ratio])
        timings[ratio] = round(time.monotonic() - t, 1)
    (out_dir / "captions.vtt").write_text(voicer.vtt(voiced["cues"]))
    (out_dir / "plan.json").write_text(json.dumps(PLAN, indent=1))
    return {"out": str(out_dir), "duration_s": voiced["duration"], "voice_s": round(t1 - t0, 1), "render_s": timings}
