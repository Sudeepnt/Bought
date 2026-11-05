"""The editorial brief (brief.yaml): which news we want. Plain keyword matching, no model."""
from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

import yaml

PATH = Path(__file__).resolve().parents[1] / "brief.yaml"


def _pattern(word: str):
    flags = 0 if word.isupper() else re.I       # "AI" must not match "ai" inside a sentence's lowercase word; "chip" matches "Chip"
    return re.compile(r"(?<![A-Za-z0-9])" + re.escape(word) + r"(?![A-Za-z0-9])", flags)


@dataclass(frozen=True)
class Brief:
    window_hours: float
    sections: dict          # {name: size}
    keywords: dict          # {name: [word, ...]}

    def __post_init__(self):
        object.__setattr__(self, "_compiled", {s: [_pattern(k) for k in ws] for s, ws in self.keywords.items()})

    def hits(self, title: str, summary: str = "") -> dict:
        """{section: score}, title hits counting double. Empty means the story is off brief."""
        out = {}
        for section, patterns in self._compiled.items():
            score = sum(2 if p.search(title) else 1 if p.search(summary) else 0 for p in patterns)
            if score:
                out[section] = score
        return out

    def section_for(self, title: str, summary: str, feed_section: str = ""):
        """The best-matching section; the feed's own section wins a tie. None if off brief."""
        hits = self.hits(title, summary)
        if not hits:
            return None
        order = list(self.sections)
        return max(hits, key=lambda s: (hits[s], s == feed_section, -order.index(s)))

    def to_json(self) -> dict:
        return {"window_hours": self.window_hours, "sections": [{"name": s, "size": n, "keywords": self.keywords[s]} for s, n in self.sections.items()]}


def load_brief(path=None) -> Brief:
    raw = yaml.safe_load(Path(path or PATH).read_text())
    return Brief(float(raw["window_hours"]), {s: int(v["size"]) for s, v in raw["sections"].items()},
                 {s: [str(k) for k in v["keywords"]] for s, v in raw["sections"].items()})
