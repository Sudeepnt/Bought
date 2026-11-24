"""Python's view of the library (pipeline/explainer/library/, written in JavaScript because the renderer is a browser).
The catalogue (objects and their parts, templates and their fields, themes, portraits, the plan schema) comes from
`node cli.cjs catalogue`, so there is one source of truth for what exists."""
from __future__ import annotations

import functools
import json
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
LIB = HERE / "library"


def node(*args, timeout=120) -> dict:
    out = subprocess.run(["node", str(HERE / "cli.cjs"), *map(str, args)], capture_output=True, check=False, timeout=timeout, cwd=HERE)
    if out.returncode:
        raise RuntimeError(f"explainer library: {(out.stderr or b'').decode(errors='replace').strip()[-400:]}")
    return json.loads(out.stdout or b"{}")


def _stamp() -> tuple:
    """Changes whenever a library file changes, so the cached catalogue is never stale."""
    files = sorted(p for p in LIB.rglob("*") if p.is_file())
    return tuple((str(p), p.stat().st_mtime_ns) for p in files)


@functools.lru_cache(maxsize=4)
def _catalogue(stamp) -> dict:
    return node("catalogue")


def catalogue() -> dict:
    return _catalogue(_stamp())


def themes() -> list:
    return catalogue()["themes"]


def theme_ids() -> list:
    return [t["id"] for t in themes()]


def gallery(theme: str = "", ratio: str = "9x16") -> dict:
    return node("gallery", json.dumps({"theme": theme, "ratio": ratio}))


def preview(plan: dict, theme: str, story: dict) -> dict:
    import tempfile
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
        json.dump({"plan": plan, "theme": theme, "story": story}, f)
    try:
        return node("preview", f.name)
    finally:
        Path(f.name).unlink(missing_ok=True)
