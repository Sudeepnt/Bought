"""Pulse shorts: fast vertical (9:16) clips with a voiceover only, no presenter. Built to hold attention.

Retention tricks used (all deterministic, CPU only, Pillow + numpy + ffmpeg + Kokoro):
  - the headline is on screen and spoken in the first second (hook), no intro
  - a new "scene" (background, accent colour, zoom direction) every beat, a hard cut every ~1.5-2.5 s
  - 2-3 word captions that pop in one chunk at a time, current chunk in the accent colour
  - slow constant zoom on the background plus a punch on every caption chunk and flash on each cut
  - progress bar on top, category tag, "N of M" beat counter so people see an end coming
  - last line leads back into the hook so the loop feels seamless
  - voice only: no music or sound effects

Run with the Kokoro venv python (it has kokoro-onnx, soundfile, numpy, Pillow):
  ~/.cache/bought/tts/venv/bin/python -m pipeline.pulse --id 293873247e6ba2c1
  ~/.cache/bought/tts/venv/bin/python -m pipeline.pulse --all          # every prime story in the dry-run feed
"""
from __future__ import annotations

import argparse
import json
import math
import re
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
W, H, FPS = 720, 1280, 30
RATE = 24000
FONT = str(ROOT / "pipeline/assets/newsreader.ttf")   # the site's headline face (SIL OFL), so clips match the cards
VOICE = "af_heart"
SPEED = 1.12                                                   # a little quicker than the newsroom voice
KOKORO = Path.home() / ".cache/bought/tts"

# Section colours, as on the site (dark-mode values): hue in degrees and how colourful the main tone is. Every clip is built from ONE of
# these: a deep top, the section colour at the bottom, and a pale tint of it for captions, tag and progress bar.
import colorsys


def _tone(h, s, l):
    return tuple(int(round(c * 255)) for c in colorsys.hls_to_rgb(h / 360, l, s))


def _section_palette(h, s):
    return (_tone(h, min(1.0, s * 0.9), 0.13), _tone(h, s, 0.40), _tone(h, 0.9, 0.84))


PALETTES = {
    "AI": _section_palette(249, 0.62),
    "Product Launches": _section_palette(146, 0.48),
    "Tech Business": _section_palette(10, 0.62),
    "Founders & Startups": _section_palette(41, 0.70),
    "Technology": _section_palette(190, 0.52),
    "Tech Geopolitics": _section_palette(322, 0.45),
}
DEFAULT_PALETTE = ((20, 20, 40), (80, 60, 200), (255, 226, 60))


# ---------- script ----------

def _sentences(text: str) -> list[str]:
    text = re.sub(r"\s+", " ", text or "").strip()
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]


def _split_long(sentence: str, limit: int = 9) -> list[str]:
    """Break a long sentence at commas / conjunctions so each beat is short and punchy (about 3 s)."""
    words = sentence.split()
    if len(words) <= limit:
        return [sentence]
    parts, cur = [], []
    for w in words:
        cur.append(w)
        if len(cur) >= 5 and (w.endswith(",") or w.lower() in {"and", "but", "while", "as", "after", "because"}) or len(cur) >= limit:
            parts.append(" ".join(cur))
            cur = []
    if cur:
        if parts and len(cur) < 3:
            parts[-1] += " " + " ".join(cur)
        else:
            parts.append(" ".join(cur))
    return parts


def make_beats(item: dict) -> list[str]:
    """Hook -> short facts -> payoff that loops back. Only uses what the story gives us."""
    headline = item["headline"].rstrip(".!? ")
    beats = [headline + "."]
    summary = item.get("summary", "")
    for s in _sentences(summary):
        if s.lower().rstrip(".") == headline.lower():
            continue
        # the generated summaries often restate the headline in their first sentence; drop that
        if s.lower().startswith(headline.lower()[:30]):
            rest = re.sub(r"^.*?\b(is|are|has|have)\b[^.]*?(industry|market|world|sector)\.?", "", s, flags=re.I).strip()
            if rest and rest != s:
                s = rest
            else:
                continue
        beats.extend(_split_long(s))
    beats.append(f"{item['category']}, in one minute. Watch again, it gets clearer." if False else "Now watch that again.")
    return beats


# ---------- audio ----------

def _wav_read(path: Path) -> np.ndarray:
    with wave.open(str(path), "rb") as w:
        return np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768


def synth(beats: list[str], voice: str = VOICE, speed: float = SPEED):
    """Kokoro once per beat (one model load). Returns [(samples, seconds)]."""
    from kokoro_onnx import Kokoro
    tts = Kokoro(str(KOKORO / "kokoro-v1.0.int8.onnx"), str(KOKORO / "voices-v1.0.bin"))
    out = []
    for b in beats:
        x, rate = tts.create(b, voice=voice, speed=speed, lang="en-us")
        x = np.asarray(x, np.float32)
        if rate != RATE:
            x = np.interp(np.linspace(0, len(x) - 1, int(len(x) * RATE / rate)), np.arange(len(x)), x)
        x = _trim(x)
        out.append(x)
    return out


def _trim(x: np.ndarray, thr: float = 0.012, keep: float = 0.04) -> np.ndarray:
    idx = np.where(np.abs(x) > thr)[0]
    if not len(idx):
        return x
    a, b = max(0, idx[0] - int(keep * RATE)), min(len(x), idx[-1] + int(keep * RATE))
    return x[a:b]


def sfx_whoosh(n: int = int(0.28 * RATE)) -> np.ndarray:
    rng = np.random.default_rng(7)
    noise = rng.standard_normal(n).astype(np.float32)
    # moving band: cumulative lowpass whose cutoff sweeps up, shaped by a quick rise and fall
    env = np.sin(np.linspace(0, math.pi, n)) ** 2
    k = np.linspace(0.02, 0.35, n)
    y = np.zeros(n, np.float32)
    s = 0.0
    for i in range(n):
        s += k[i] * (noise[i] - s)
        y[i] = noise[i] - s  # highpass of the sweeping lowpass
    return (y * env * 0.18).astype(np.float32)


def bed(seconds: float) -> np.ndarray:
    """Quiet pulse under the voice: 126 bpm kick on every beat plus a soft low note. Just enough to feel 'driven'."""
    n = int(seconds * RATE)
    t = np.arange(n) / RATE
    beat = 60 / 126
    ph = (t % beat)
    kick = np.sin(2 * math.pi * (55 + 90 * np.exp(-ph * 30)) * ph) * np.exp(-ph * 9)
    note = np.sin(2 * math.pi * 55 * t) * 0.25 + np.sin(2 * math.pi * 82.4 * t) * 0.12
    return ((kick * 0.5 + note) * 0.08).astype(np.float32)


# ---------- visuals ----------

_fonts: dict[int, ImageFont.FreeTypeFont] = {}


def font(size: int):
    if size not in _fonts:
        f = ImageFont.truetype(FONT, size)
        f.set_variation_by_name("ExtraBold")
        _fonts[size] = f
    return _fonts[size]


def ease_out_back(x: float) -> float:
    x = min(max(x, 0.0), 1.0)
    c1, c3 = 1.9, 2.9
    return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2


def gradient(top, bottom, shift: float) -> Image.Image:
    y = np.linspace(0, 1, H, dtype=np.float32)[:, None]
    y = np.clip(y + 0.12 * np.sin(shift * 2 * math.pi + y * 3), 0, 1)
    arr = np.zeros((H, W, 3), np.float32)
    for c in range(3):
        arr[:, :, c] = top[c] * (1 - y) + bottom[c] * y
    return Image.fromarray(arr.astype(np.uint8))


def cover(img: Image.Image, zoom: float, cx: float, cy: float) -> Image.Image:
    """Crop `img` to the 9:16 frame at `zoom`, centred at (cx, cy) in 0..1, then resize."""
    iw, ih = img.size
    base = max(W / iw, H / ih)
    cw, ch = W / (base * zoom), H / (base * zoom)
    x0 = min(max(cx * iw - cw / 2, 0), iw - cw)
    y0 = min(max(cy * ih - ch / 2, 0), ih - ch)
    return img.crop((int(x0), int(y0), int(x0 + cw), int(y0 + ch))).resize((W, H), Image.BILINEAR)


def chunks(beat: str, size: int = 3) -> list[str]:
    words = beat.split()
    out, cur = [], []
    for w in words:
        cur.append(w)
        if len(cur) >= size or w.endswith((",", ".", "?", "!")):
            out.append(" ".join(cur))
            cur = []
    if cur:
        if out and len(cur) == 1 and len(out[-1].split()) < size:
            out[-1] += " " + cur[0]
        else:
            out.append(" ".join(cur))
    return out


def draw_caption(base: Image.Image, text: str, t_in: float, accent, y_frac: float, big: bool):
    """One caption chunk with a pop-in; auto-shrinks to fit the width."""
    text = text.rstrip(".")
    size = 40 if big else 36
    lines = _wrap(text, size)
    while size > 24:
        lines = _wrap(text, size)
        if max(font(size).getlength(l) for l in lines) <= W - 80 and len(lines) <= 3:
            break
        size -= 6
    scale = 0.55 + 0.45 * ease_out_back(t_in / 0.14)
    layer = Image.new("RGBA", (W, 420), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    lh = int(size * 1.08)
    total = lh * len(lines)
    y = (420 - total) // 2
    for l in lines:
        wl = font(size).getlength(l)
        x = (W - wl) / 2
        for ox, oy in [(-3, 0), (3, 0), (0, -3), (0, 3), (-2, -2), (2, 2), (-2, 2), (2, -2), (0, 5)]:
            d.text((x + ox, y + oy), l, font=font(size), fill=(8, 6, 20, 255))
        d.text((x, y), l, font=font(size), fill=(255, 255, 255, 255))
        y += lh
    if scale != 1:
        nw, nh = max(1, int(W * scale)), max(1, int(420 * scale))
        layer = layer.resize((nw, nh), Image.BILINEAR)
    cy = int(H * y_frac)
    base.alpha_composite(layer, (W // 2 - layer.width // 2, cy - layer.height // 2))


DM = str(ROOT / "pipeline/assets/fonts/font-0.ttf")   # DM Sans Regular, the site's body face
_dm: dict[int, ImageFont.FreeTypeFont] = {}


def font_dm(size: int):
    if size not in _dm:
        _dm[size] = ImageFont.truetype(DM, size)
    return _dm[size]


def _lines(text, f, maxw):
    words, lines, cur = text.split(), [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        if f.getlength(trial) <= maxw or not cur:
            cur = trial
        else:
            lines.append(cur); cur = w
    return lines + ([cur] if cur else [])


def draw_caption_styled(base, style, beat, cks, ci, t_in, prog, accent, y_frac=0.62):
    """Seven small caption looks, one per clip: pop, box, highlight, karaoke, typewriter, bar, stamp."""
    d = ImageDraw.Draw(base)
    chunk = cks[ci].rstrip(".")
    cx, cy = W // 2, int(H * y_frac)
    fade = min(1.0, t_in / 0.12)
    if style == "pop":
        return draw_caption(base, cks[ci], t_in, accent, y_frac, True)
    if style == "box":      # black rounded box, white text, one chunk at a time (the TikTok default)
        f = font(40); w = f.getlength(chunk)
        sc = 0.9 + 0.1 * ease_out_back(t_in / 0.12)
        bw, bh = (w + 44) * sc, 70 * sc
        d.rounded_rectangle((cx - bw / 2, cy - bh / 2, cx + bw / 2, cy + bh / 2), 16, fill=(0, 0, 0, 190))
        d.text((cx - w * sc / 2, cy - 24 * sc), chunk, font=font(int(40 * sc)), fill=(255, 255, 255, 255))
        return
    if style == "highlight":   # marker-pen block, dark text
        f = font(38); w = f.getlength(chunk)
        layer = Image.new("RGBA", (W, 120), (0, 0, 0, 0)); ld = ImageDraw.Draw(layer)
        ld.rounded_rectangle((W / 2 - w / 2 - 18, 22, W / 2 + w / 2 + 18, 92), 8, fill=accent + (255,))
        ld.text((W / 2 - w / 2, 36), chunk, font=f, fill=(18, 14, 30, 255))
        layer = layer.rotate(-1.6 if ci % 2 == 0 else 1.6, resample=Image.BILINEAR)
        base.alpha_composite(layer, (0, cy - 60))
        return
    if style == "karaoke":     # the whole line stays up; the chunk being spoken lights up
        f = font(34); maxw = W - 90
        words = beat.rstrip(".").split(); lens = [len(c.split()) for c in cks]
        start = sum(lens[:ci]); active = set(range(start, start + lens[ci]))
        lines, idx, cur = [], 0, []
        for i, wd in enumerate(words):
            trial = " ".join(x for x, _ in cur + [(wd, i)])
            if f.getlength(trial) > maxw and cur:
                lines.append(cur); cur = []
            cur.append((wd, i))
        lines.append(cur)
        y = cy - len(lines) * 26
        for ln in lines:
            total = f.getlength(" ".join(x for x, _ in ln)); x = cx - total / 2
            for wd, i in ln:
                col = accent + (255,) if i in active else (255, 255, 255, 150)
                for ox, oy in [(-2, 0), (2, 0), (0, -2), (0, 2)]:
                    d.text((x + ox, y + oy), wd, font=f, fill=(8, 6, 20, 255))
                d.text((x, y), wd, font=f, fill=col)
                x += f.getlength(wd + " ")
            y += 52
        return
    if style == "typewriter":  # DM Sans, left aligned, letters appear as they are spoken, block cursor
        f = font_dm(34)
        shown = chunk[: max(1, int(len(chunk) * min(1.0, t_in / 0.55)))]
        w = f.getlength(chunk)
        x = 44
        d.rectangle((0, cy - 36, W, cy + 36), fill=(0, 0, 0, 120))
        d.text((x, cy - 20), shown, font=f, fill=(255, 255, 255, 255))
        d.rectangle((x + f.getlength(shown) + 4, cy - 18, x + f.getlength(shown) + 18, cy + 18), fill=accent + (255,))
        return
    if style == "bar":         # a full-width subtitle bar with the sentence in two lines, like TV subtitles
        f = font_dm(30); lines = _lines(beat.rstrip("."), f, W - 100)[:3]
        bh = 24 + 42 * len(lines)
        layer = Image.new("RGBA", (W, bh), (10, 10, 16, int(205 * fade)))
        base.alpha_composite(layer, (0, cy - bh // 2))
        y = cy - bh // 2 + 12
        for ln in lines:
            d.text((cx - f.getlength(ln) / 2, y), ln, font=f, fill=(255, 255, 255, int(255 * fade)))
            y += 42
        return
    # stamp: tracked-out capitals with an underline that grows under each chunk
    text = chunk.upper(); f = font(34)
    track = 5; w = sum(f.getlength(ch) + track for ch in text) - track
    x = cx - w / 2
    for ch in text:
        for ox, oy in [(-2, 0), (2, 0), (0, -2), (0, 2)]:
            d.text((x + ox, cy - 22 + oy), ch, font=f, fill=(8, 6, 20, 255))
        d.text((x, cy - 22), ch, font=f, fill=(255, 255, 255, 255))
        x += f.getlength(ch) + track
    d.rectangle((cx - w / 2, cy + 26, cx - w / 2 + w * min(1.0, t_in / 0.25), cy + 31), fill=accent + (255,))


def _wrap(text: str, size: int) -> list[str]:
    words, lines, cur = text.split(), [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        if font(size).getlength(trial) <= W - 80 or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def tag(base: Image.Image, text: str, accent):
    d = ImageDraw.Draw(base)
    f = font(30)
    t = text.upper()
    w = f.getlength(t) + 44
    d.rounded_rectangle((36, 70, 36 + w, 70 + 54), 14, fill=accent + (255,))
    d.text((58, 76), t, font=f, fill=(12, 10, 30, 255))


SHOT_LEN = 1.5   # seconds: a new shot (other photo, other treatment, other crop) at least this often


def duotone(img: Image.Image, accent) -> Image.Image:
    g = img.convert("L")
    dark = (12, 10, 30)
    return Image.merge("RGB", [g.point(lambda v, d=d, a=a: int(d + (a - d) * v / 255)) for d, a in zip(dark, accent)])


def split_screen(imgs, t, accent, k):
    top = cover(imgs[0], 1.1 + 0.08 * t, 0.35, 0.4).crop((0, 0, W, H // 2))
    bot = cover(imgs[1], 1.25 - 0.08 * t, 0.65, 0.6).crop((0, H // 2, W, H))
    f = Image.new("RGB", (W, H))
    f.paste(top, (0, 0)); f.paste(bot, (0, H // 2))
    ImageDraw.Draw(f).rectangle((0, H // 2 - 5, W, H // 2 + 5), fill=accent)
    return f


def render_frames(beats, audio, timeline, palette, images, category, headline, stats, out_pipe, style="pop"):
    top, bottom, accent = palette
    total = timeline[-1][1]
    nframes = int(math.ceil(total * FPS))
    imgs = [Image.open(p).convert("RGB") for p in images]
    rng = np.random.default_rng(3)
    # shot plan: every beat is cut into shots of ~SHOT_LEN; each shot gets its own photo, treatment and crop
    treatments = ["full", "tint", "split", "full", "tint", "full", "split", "full"]
    shots = {}   # (beat, shot) -> look
    g = 0
    def shot_look(bi, si):
        nonlocal g
        key = (bi, si)
        if key not in shots:
            stat = stats.get(str(bi)) if si == 0 else None
            tr = "stat" if stat else (treatments[g % len(treatments)] if imgs else "color")
            shots[key] = dict(tr=tr, stat=stat, a=g % max(len(imgs), 1), b=(g + 2) % max(len(imgs), 1),
                              cx=0.25 + 0.5 * rng.random(), cy=0.3 + 0.4 * rng.random(), zoom_dir=1 if g % 2 == 0 else -1)
            g += 1
        return shots[key]
    chunk_cache = [chunks(b) for b in beats]
    for fi in range(nframes):
        t = fi / FPS
        bi = max(j for j, (s, e) in enumerate(timeline) if s <= t) if t < total else len(beats) - 1
        s, e = timeline[bi]
        nshots = max(1, round((e - s) / SHOT_LEN))
        si = min(int((t - s) / ((e - s) / nshots)), nshots - 1)
        look = shot_look(bi, si)
        s0 = s + si * (e - s) / nshots
        local = (t - s0) / ((e - s) / nshots)
        z = 1.08 + 0.22 * local if look["zoom_dir"] > 0 else 1.30 - 0.22 * local
        tr = look["tr"]
        if tr in ("full", "tint", "stat") and imgs:
            im = cover(imgs[look["a"]], z, look["cx"], look["cy"])
            if tr in ("tint", "stat"):
                im = duotone(im, accent)
            else:   # the photo keeps its detail but takes the section colour
                im = Image.blend(im, duotone(im, accent), 0.5)
            frame = im.convert("RGBA")
            frame.alpha_composite(Image.new("RGBA", (W, H), (0, 0, 0, 90 if tr == "full" else 45)))
        elif tr == "split" and len(imgs) > 1:
            sp = split_screen([imgs[look["a"]], imgs[look["b"]]], local, accent, g)
            frame = Image.blend(sp, duotone(sp, accent), 0.5).convert("RGBA")
            frame.alpha_composite(Image.new("RGBA", (W, H), (0, 0, 0, 60)))
        else:   # colour scene (also used for stat cards)
            frame = gradient(top, bottom, t / 6 + bi * 0.17).convert("RGBA")
            ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            od = ImageDraw.Draw(ov)
            for k in range(5):
                x = ((t * (60 + 25 * k) * (1 if (k + bi) % 2 else -1)) + k * 170) % (W + 300) - 150
                od.rectangle((x, 0, x + 90, H), fill=(255, 255, 255, 14))
            frame.alpha_composite(ov)
        if look["stat"]:   # giant number that punches in, caption underneath
            sz = 190
            while font(sz).getlength(look["stat"]) > W - 60 and sz > 60:
                sz -= 10
            pop = 0.7 + 0.3 * ease_out_back((t - s0) / 0.18)
            layer = Image.new("RGBA", (W, 300), (0, 0, 0, 0))
            ld = ImageDraw.Draw(layer)
            x = (W - font(sz).getlength(look["stat"])) / 2
            for ox, oy in [(-8, 0), (8, 0), (0, -8), (0, 8), (0, 14)]:
                ld.text((x + ox, 30 + oy), look["stat"], font=font(sz), fill=(8, 6, 20, 255))
            ld.text((x, 30), look["stat"], font=font(sz), fill=(255, 255, 255, 255))
            layer = layer.resize((int(W * pop), int(300 * pop)), Image.BILINEAR)
            frame.alpha_composite(layer, (W // 2 - layer.width // 2, int(H * 0.36) - layer.height // 2))
        cks = chunk_cache[bi]
        lens = np.array([max(len(c), 3) for c in cks], np.float32)
        edges = s + (e - s) * np.concatenate([[0], np.cumsum(lens) / lens.sum()])
        ci = min(int(np.searchsorted(edges, t, side="right")) - 1, len(cks) - 1)
        draw_caption_styled(frame, style, beats[bi], cks, ci, t - edges[ci], 0, accent)
        d = ImageDraw.Draw(frame)
        d.rectangle((0, 0, W, 14), fill=(255, 255, 255, 40))
        d.rectangle((0, 0, int(W * t / total), 14), fill=accent + (255,))
        label = f"{bi + 1}/{len(beats)}"
        d.text((W - 36 - font(28).getlength(label), 38), label, font=font(28), fill=(255, 255, 255, 230))
        since_cut = t - s0
        if since_cut < 0.09:   # white flash on every cut
            frame.alpha_composite(Image.new("RGBA", (W, H), (255, 255, 255, int(150 * (1 - since_cut / 0.09)))))
        out_pipe.write(frame.convert("RGB").tobytes())
    return nframes


# ---------- assemble ----------

def build(item: dict, out_dir: Path, images: list, voice: str = VOICE) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    beats = item.get("beats") or make_beats(item)
    voices = synth(beats, voice)
    gap = int(0.10 * RATE)
    timeline, parts, t = [], [], 0.0
    pad = np.zeros(gap, np.float32)
    for x in voices:
        dur = (len(x) + gap) / RATE
        timeline.append((t, t + dur))
        parts.append(np.concatenate([x, pad]))
        t += dur
    voice_track = np.concatenate(parts)
    total = len(voice_track) / RATE
    mix = np.clip(voice_track * 0.95, -1, 1)   # voice only: no music, no sound effects
    wav = out_dir / f"{item['id']}.pulse.wav"
    with wave.open(str(wav), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(RATE)
        w.writeframes((mix * 32767).astype(np.int16).tobytes())
    mp4 = out_dir / f"{item['id']}.pulse.mp4"
    palette = PALETTES.get(item["category"], DEFAULT_PALETTE)
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
           "-i", "-", "-i", str(wav), "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-pix_fmt", "yuv420p",
           "-c:a", "aac", "-b:a", "128k", "-shortest", "-movflags", "+faststart", str(mp4)]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    render_frames(beats, mix, timeline, palette, images, item["category"], item["headline"], item.get("stats", {}), p.stdin, item.get("caption", "pop"))
    p.stdin.close()
    if p.wait():
        raise RuntimeError("ffmpeg failed")
    wav.unlink()
    print(f"{mp4}  {total:.1f}s  {len(beats)} beats")
    return mp4


def from_spec(path: str) -> list[dict]:
    """Hand-written clips (pulse_clips.json): same fields as a feed item, plus `beats` and `slug`."""
    out = []
    for c in json.loads(Path(path).read_text()):
        out.append({"id": c["slug"], "category": c["category"], "headline": c["headline"], "beats": c["beats"],
                    "images": [str(ROOT / i) for i in c.get("images", [])], "stats": c.get("stats", {}), "caption": c.get("caption", "pop")})
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--spec", help="JSON list of hand-written clips (default: the feed's prime stories)")
    ap.add_argument("--feed", default=str(ROOT / "pipeline/out/dry_run/feed.json"))
    ap.add_argument("--id")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--image", help="background image (jpg/png); default: none, animated colour scenes only")
    ap.add_argument("--out", default=str(ROOT / "pipeline/out/pulse"))
    ap.add_argument("--voice", default=VOICE)
    a = ap.parse_args()
    items = from_spec(a.spec) if a.spec else json.loads(Path(a.feed).read_text())["prime"]
    if a.id:
        items = [i for i in items if i["id"] == a.id]
    elif not a.all:
        items = items[:1]
    for it in items:
        imgs = [a.image] if a.image else it.get("images", [])
        build(it, Path(a.out), imgs, a.voice)


if __name__ == "__main__":
    sys.exit(main())
