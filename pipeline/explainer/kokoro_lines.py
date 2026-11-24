"""Kokoro-82M (Apache-2.0), many lines in one go: the model loads once, then each line gets its own wav, so the
explainer knows every line's exact length (that drives the scene timing and the captions).

Usage (run with the Python that has kokoro-onnx; see explainer_tts_command in config.yaml):
  python kokoro_lines.py MODEL.onnx VOICES.bin VOICE SPEED  < [{"text": "...", "out": "/path/line-00.wav"}, ...]
VOICE may be two names joined by "+" for an even blend.
"""
import json
import os
import sys

import soundfile as sf
from kokoro_onnx import Kokoro

model, voices, voice = sys.argv[1:4]
speed = float(sys.argv[4]) if len(sys.argv) > 4 else 1.0
tts = Kokoro(model, voices)
names = voice.split("+")
style = sum(tts.get_voice_style(n) for n in names) / len(names) if len(names) > 1 else voice
lang = "en-gb" if names[0].startswith("b") else "en-us"
for job in json.load(sys.stdin):
    samples, rate = tts.create(job["text"], voice=style, speed=speed, lang=lang)
    tmp = job["out"] + ".tmp"
    sf.write(tmp, samples, rate, format="WAV")
    os.replace(tmp, job["out"])
print(json.dumps({"ok": True}))
