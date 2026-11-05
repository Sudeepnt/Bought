"""Prime videos: one themed 16:9 frame per story (pipeline/assets/prime_themes.css, 20 looks), voice-over only, no journalist.

Run with the Kokoro venv python (it has kokoro-onnx):
  ~/.cache/bought/tts/venv/bin/python -m pipeline.prime            # all 20 prime stories, story i gets theme i+1
  ~/.cache/bought/tts/venv/bin/python -m pipeline.prime --only 3 5 # just those themes
Output: public/prime/<story id>.mp4 + .jpg
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

import numpy as np

from .pulse import RATE, _trim, KOKORO

ROOT = Path(__file__).resolve().parent.parent
PHOTOS = ["swipe-robotics", "swipe-data-center", "swipe-rocket", "swipe-battery", "podcast-earth", "grok-story-hero"]
EXT = {"grok-story-hero": "png"}
# a different voice per story so the next one does not sound the same
VOICES = ["af_heart", "am_michael", "bf_emma", "af_nova", "am_adam", "bf_isabella", "af_bella", "bm_george", "af_sky", "am_liam",
          "af_kore", "bm_lewis", "af_jessica", "am_eric", "bf_lily", "af_river", "am_onyx", "bf_alice", "af_sarah", "bm_daniel"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--feed", default=str(ROOT / "pipeline/out/dry_run/feed.json"))
    ap.add_argument("--out", default=str(ROOT / "public/prime"))
    ap.add_argument("--only", nargs="*", type=int, help="theme numbers (1-20) to render")
    ap.add_argument("--reuse-audio", action="store_true", help="take the voice from the existing .mp4 instead of speaking it again (for a re-colour)")
    a = ap.parse_args()
    items = json.loads(Path(a.feed).read_text())["prime"][:20]
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    tts = None
    if not a.reuse_audio:
        from kokoro_onnx import Kokoro
        tts = Kokoro(str(KOKORO / "kokoro-v1.0.int8.onnx"), str(KOKORO / "voices-v1.0.bin"))
    tmp = Path(tempfile.mkdtemp(prefix="prime-"))
    for i, it in enumerate(items):
        theme = i + 1
        if a.only and theme not in a.only:
            continue
        wav = tmp / f"{it['id']}.wav"
        if a.reuse_audio:   # the same voice track as the video already has
            old = out / f"{it['id']}.mp4"
            keep = tmp / f"{it['id']}.old.mp4"; keep.write_bytes(old.read_bytes())
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(keep), "-vn", "-ac", "1", "-ar", str(RATE), str(wav)], check=True)
            with wave.open(str(wav)) as w:
                dur = w.getnframes() / w.getframerate()
        else:
            x, rate = tts.create(it["script"], voice=VOICES[i % len(VOICES)], speed=1.05, lang="en-gb" if VOICES[i % len(VOICES)].startswith("b") else "en-us")
            x = np.asarray(x, np.float32)
            if rate != RATE:
                x = np.interp(np.linspace(0, len(x) - 1, int(len(x) * RATE / rate)), np.arange(len(x)), x)
            x = np.concatenate([np.zeros(int(0.5 * RATE), np.float32), _trim(x), np.zeros(int(0.7 * RATE), np.float32)])
            with wave.open(str(wav), "wb") as w:
                w.setnchannels(1); w.setsampwidth(2); w.setframerate(RATE)
                w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())
            dur = len(x) / RATE
        photos = [PHOTOS[(i * 2 + k) % len(PHOTOS)] for k in range(4)]
        spec = {"theme": theme, "cat": it["category"], "n": i + 1, "src": it["source"], "h": it["headline"].rstrip("."),
                "s": it["summary"], "next": [items[(i + k) % len(items)]["headline"] for k in (1, 2, 3)],
                "images": [str(ROOT / f"public/assets/{p}.{EXT.get(p, 'jpg')}") for p in photos],
                "wav": str(wav), "dur": dur, "out": str(out / f"{it['id']}.mp4"), "poster": str(out / f"{it['id']}.jpg")}
        sp = tmp / f"{it['id']}.json"; sp.write_text(json.dumps(spec))
        print(f"theme {theme:02d} {it['headline'][:50]} ({spec['dur']:.1f}s)", flush=True)
        subprocess.run(["node", str(ROOT / "pipeline/prime_render.cjs"), str(sp)], check=True)


if __name__ == "__main__":
    sys.exit(main())
