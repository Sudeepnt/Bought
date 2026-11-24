"""Render one story's explainer in each ratio: the library builds the page (cli.cjs page), headless Chromium plays it frame
by frame with every animation pinned to the frame's time (render.cjs), ffmpeg encodes H.264 with the mixed sound.
Heavy work runs at the lowest CPU and disk priority, so readers always come first."""
from __future__ import annotations

import json
import os
import shutil
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
SIZE = {"9x16": (1080, 1920), "16x9": (1920, 1080)}


def low(cmd: list) -> tuple:
    """(command, preexec): ionice idle where the system has it, and nice 19."""
    if shutil.which("ionice"):
        cmd = ["ionice", "-c", "3", *cmd]

    def nice():
        try:
            os.nice(max(0, 19 - os.nice(0)))
        except OSError:
            pass
    return cmd, nice


def run_low(cmd: list, timeout: int) -> None:
    cmd, pre = low(cmd)
    out = subprocess.run(cmd, capture_output=True, timeout=timeout, preexec_fn=pre, cwd=HERE)
    if out.returncode:
        raise RuntimeError(f"{Path(cmd[-2] if len(cmd) > 1 else cmd[0]).name} exited {out.returncode}: {(out.stderr or b'').decode(errors='replace').strip()[-400:]}")


def page(job: dict, path: Path) -> dict:
    jp = path.with_suffix(".job.json")
    jp.write_text(json.dumps(job, ensure_ascii=False))
    out = subprocess.run(["node", str(HERE / "cli.cjs"), "page", str(jp), str(path)], capture_output=True, timeout=120, cwd=HERE)
    jp.unlink(missing_ok=True)
    if out.returncode:
        raise RuntimeError(f"page: {(out.stderr or b'').decode(errors='replace').strip()[-400:]}")
    return json.loads(out.stdout)


def poster_time(timing: list) -> float:
    """A still from the first scene once its drawing has come in."""
    first = timing[0]
    return round(min(first["end"] - 0.2, first["start"] + 2.8), 2)


def render(plan: dict, theme: str, story: dict, voiced: dict, audio: Path | None, out_dir: Path, work: Path, cfg, ratios=None) -> dict:
    """Writes <ratio>.mp4 and <ratio>.jpg for each ratio. Returns {"portraits": [...], "missing": [...], "files": {...}}."""
    out_dir.mkdir(parents=True, exist_ok=True)
    work.mkdir(parents=True, exist_ok=True)
    used, missing, files = [], [], {}
    for ratio in ratios or cfg.explainer_ratios:
        html = work / f"page-{ratio}.html"
        got = page({"plan": plan, "theme": theme, "ratio": ratio, "story": story, "timing": voiced["timing"]}, html)
        used += [p for p in got["portraits"] if p not in used]
        missing += [m for m in got["missing"] if m not in missing]
        mp4, jpg = out_dir / f"{ratio}.mp4", out_dir / f"{ratio}.jpg"
        tmp = mp4.with_name(mp4.stem + ".tmp.mp4")
        job = {"page": str(html), "out": str(tmp), "poster": str(jpg), "poster_at": poster_time(voiced["timing"]), "audio": str(audio) if audio else None,
               "duration": voiced["duration"], "fps": cfg.explainer_fps, "ratio": ratio}
        jj = work / f"render-{ratio}.json"
        jj.write_text(json.dumps(job))
        run_low(["node", str(HERE / "render.cjs"), str(jj)], timeout=max(1800, int(voiced["duration"] * 60)))
        tmp.replace(mp4)
        gate(mp4, jpg, voiced["duration"], SIZE[ratio], audio is not None)
        files[ratio] = {"video": mp4.name, "poster": jpg.name, "bytes": mp4.stat().st_size}
        html.unlink(missing_ok=True)
        jj.unlink(missing_ok=True)
    return {"portraits": used, "missing": missing, "files": files}


def gate(mp4: Path, poster: Path, duration: float, size: tuple, sound=True) -> None:
    """The last check before a video can go out. Raises with the reason."""
    from PIL import Image, ImageStat
    info = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,codec_name,width,height:format=duration", "-of", "json", str(mp4)],
                                     capture_output=True, check=True, timeout=60).stdout)
    kinds = {s["codec_type"] for s in info["streams"]}
    if "video" not in kinds or (sound and "audio" not in kinds):
        raise ValueError(f"streams are {sorted(kinds)}")
    v = next(s for s in info["streams"] if s["codec_type"] == "video")
    if (v["width"], v["height"]) != tuple(size) or v.get("codec_name") != "h264":
        raise ValueError(f"video is {v.get('codec_name')} {v['width']}x{v['height']}")
    if abs(float(info["format"]["duration"]) - duration) > 1.0:
        raise ValueError(f"video runs {info['format']['duration']}s, the plan {duration}s")
    with Image.open(poster) as im:
        stat = ImageStat.Stat(im.convert("L"))
    if stat.stddev[0] < 6:
        raise ValueError("the still frame is blank")
