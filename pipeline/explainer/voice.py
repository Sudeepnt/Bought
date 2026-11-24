"""The voice: Kokoro runs locally (no AI service). One clip per narration line, so every line's exact length is known;
that length sets each scene's timing and each caption's start and end. No forced alignment needed.

Under the voice a quiet music bed: a loop made here by code (pure tones, so we own it outright), ducked further while
someone speaks. Captions go to captions.vtt from the same line timings."""
from __future__ import annotations

import array
import json
import math
import re
import subprocess
import wave
from pathlib import Path

RATE = 24000
LEAD, GAP, TAIL, FIRST_LEAD, END_CARD = 0.35, 0.28, 0.55, 0.6, 3.6     # seconds
BED_VERSION = "1"


def lines(narration: str) -> list:
    """The narration split into the lines the voice reads one at a time: sentences, and a very long sentence at a comma."""
    text = re.sub(r"\s+", " ", str(narration or "")).strip()
    out = []
    for s in re.split(r"(?<=[.!?])\s+(?=[A-Z0-9“\"'‘(])", text):
        s = s.strip()
        while len(s) > 150 and ", " in s[40:-20]:
            cut = s.rfind(", ", 40, 150)
            if cut < 0:
                cut = s.find(", ", 40)
            out.append(s[:cut + 1])
            s = s[cut + 2:].strip()
        if s:
            out.append(s)
    return out


def kokoro(cfg, jobs: list, voice: str) -> None:
    """Speak every line of a story in one run of the model: [{"text", "out"}] -> one wav per line."""
    if not jobs:
        return
    cmd = [a.replace("{voice}", voice).replace("{speed}", str(cfg.tts_speed)) for a in cfg.explainer_tts_command]
    out = subprocess.run(cmd, input=json.dumps(jobs).encode(), capture_output=True, timeout=max(120, 30 * len(jobs)), cwd=Path(__file__).resolve().parents[2])
    if out.returncode:
        raise RuntimeError(f"voice exited {out.returncode}: {(out.stderr or b'').decode(errors='replace').strip()[-300:]}")


def read_wav(path: Path) -> array.array:
    """Mono 16-bit samples at RATE (ffmpeg converts anything else)."""
    with wave.open(str(path)) as w:
        if (w.getnchannels(), w.getsampwidth(), w.getframerate()) == (1, 2, RATE):
            a = array.array("h")
            a.frombytes(w.readframes(w.getnframes()))
            return a
    tmp = path.with_suffix(".conv.wav")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(path), "-ac", "1", "-ar", str(RATE), "-sample_fmt", "s16", str(tmp)], check=True, timeout=60)
    try:
        return read_wav(tmp)
    finally:
        tmp.unlink(missing_ok=True)


def write_wav(path: Path, samples: array.array) -> None:
    tmp = path.with_suffix(".tmp.wav")
    with wave.open(str(tmp), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(samples.tobytes())
    tmp.replace(path)


def make_voice(plan: dict, work: Path, cfg, voice: str, speak=kokoro) -> dict:
    """Speak the plan. Returns {"duration", "timing": [{start, end, cues: [{text, start, end}]}], "cues": [absolute]} and writes voice.wav."""
    work.mkdir(parents=True, exist_ok=True)
    per_scene = [lines(sc.get("narration", "")) if sc.get("template") != "end_card" else [] for sc in plan["scenes"]]
    jobs = [{"text": ln, "out": str(work / f"line-{i:02d}-{k:02d}.wav")} for i, ls in enumerate(per_scene) for k, ln in enumerate(ls)]
    speak(cfg, jobs, voice)
    clips = {j["out"]: read_wav(Path(j["out"])) for j in jobs}
    t, timing, cues, track = 0.0, [], [], []
    for i, ls in enumerate(per_scene):
        start = t
        local = FIRST_LEAD if i == 0 else LEAD
        scene_cues = []
        for k, ln in enumerate(ls):
            samples = clips[str(work / f"line-{i:02d}-{k:02d}.wav")]
            dur = len(samples) / RATE
            track.append((start + local, samples))
            scene_cues.append({"text": ln, "start": round(local, 3), "end": round(local + dur + GAP, 3)})
            cues.append({"text": ln, "start": round(start + local, 3), "end": round(start + local + dur, 3)})
            local += dur + GAP
        length = END_CARD if not ls else local - GAP + TAIL
        timing.append({"start": round(start, 3), "end": round(start + length, 3), "cues": scene_cues})
        t = start + length
    total = array.array("h", bytes(2 * int(math.ceil(t * RATE))))
    for at, samples in track:
        o = int(at * RATE)
        total[o:o + len(samples)] = samples[: max(0, len(total) - o)]
    write_wav(work / "voice.wav", total)
    for j in jobs:
        Path(j["out"]).unlink(missing_ok=True)
    return {"duration": round(t, 3), "timing": timing, "cues": cues}


def music_bed(path: Path) -> Path:
    """An eight-second pad in A major made from pure tones: owned by us, no licence needed. Made once, then reused."""
    if path.exists():
        return path
    path.parent.mkdir(parents=True, exist_ok=True)
    notes = (110.0, 164.81, 220.0, 277.18, 329.63)
    expr = "+".join(f"{0.16 / (k + 1):.3f}*sin(2*PI*{f}*t)*(0.55+0.45*sin(2*PI*{0.125 * (1 + k % 2)}*t+{k}))" for k, f in enumerate(notes))
    tmp = path.with_suffix(".tmp.wav")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", f"aevalsrc='{expr}':s={RATE}:d=8", "-af", "lowpass=f=1800,volume=0.8",
                    "-ac", "1", "-ar", str(RATE), str(tmp)], check=True, timeout=60)
    tmp.replace(path)
    return path


def mix(voice_wav: Path, bed: Path, out: Path, duration: float, bed_db: float) -> Path:
    """Voice over the looped bed; the bed ducks under the voice (sidechain), fades in and out."""
    fade = max(0.0, duration - 1.5)
    graph = (f"[1:a]volume={bed_db}dB,afade=t=in:d=1,afade=t=out:st={fade:.2f}:d=1.5[bed];"
             "[0:a]asplit=2[v][key];[bed][key]sidechaincompress=threshold=0.02:ratio=6:attack=20:release=400[ducked];"
             "[v][ducked]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95[out]")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(voice_wav), "-stream_loop", "-1", "-i", str(bed), "-filter_complex", graph,
                    "-map", "[out]", "-t", f"{duration:.3f}", "-ac", "1", "-ar", "48000", str(out)], check=True, timeout=300)
    return out


def vtt(cues: list) -> str:
    def ts(s):
        h, rem = divmod(max(0.0, s), 3600)
        m, sec = divmod(rem, 60)
        return f"{int(h):02d}:{int(m):02d}:{sec:06.3f}"
    return "WEBVTT\n\n" + "\n\n".join(f"{n + 1}\n{ts(c['start'])} --> {ts(c['end'])}\n{c['text']}" for n, c in enumerate(cues)) + "\n"
