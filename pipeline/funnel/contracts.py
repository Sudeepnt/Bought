"""The typed boundary of the funnel. Anything from outside (a model, a licence field) is parsed here or it does not get in.

Assessment is the ONLY thing jev can hand back: is this news for Bought, how much, and which section. It has no field for text
that reaches a reader, so it cannot write a headline, a script or a picture. Headlines come from untrusted feeds, so a prompt
injection can at worst get one story wrongly in or out.
"""
from __future__ import annotations

import math
from dataclasses import asdict, dataclass
from typing import Iterable, Optional

CONTRACT_VERSION = "1"
CATEGORIES = ("Technology", "AI", "Tech business", "Founders & startups", "Product launches", "Tech geopolitics")
DECISIONS = ("keep", "drop")
MAX_REASON = 200
_FIELDS = {"article_id", "decision", "relevance", "category", "reason"}


class ContractError(ValueError):
    """Input broke a contract. The caller falls back to the rules; it never repairs the data."""


@dataclass(frozen=True)
class Candidate:
    """What an evaluator is shown about a story."""
    id: str
    headline: str
    summary: str
    source: str
    category: str
    published_at: str
    link: str = ""

    def to_json(self) -> dict:
        return asdict(self)


@dataclass(frozen=True)
class Assessment:
    article_id: str
    decision: str
    relevance: float              # 0..1; the stories that run in each section are its highest
    category: Optional[str]       # one of CATEGORIES, or None to keep the current section
    reason: str                   # for the log only, never shown to a reader

    @classmethod
    def parse(cls, obj, allowed_ids: Iterable[str]) -> "Assessment":
        if not isinstance(obj, dict):
            raise ContractError("assessment must be an object")
        if set(obj) != _FIELDS:
            raise ContractError(f"fields must be exactly {sorted(_FIELDS)}, got {sorted(map(str, obj))}")
        aid, decision, relevance, category, reason = (obj[k] for k in ("article_id", "decision", "relevance", "category", "reason"))
        if not isinstance(aid, str) or aid not in set(allowed_ids):
            raise ContractError(f"article_id {aid!r} was not in the batch")
        if decision not in DECISIONS:
            raise ContractError(f"decision must be one of {DECISIONS}")
        if isinstance(relevance, bool) or not isinstance(relevance, (int, float)) or not math.isfinite(relevance) or not 0 <= relevance <= 1:
            raise ContractError("relevance must be a number from 0 to 1")
        if category is not None and category not in CATEGORIES:
            raise ContractError(f"category must be null or one of {CATEGORIES}")
        if not isinstance(reason, str) or len(reason) > MAX_REASON:
            raise ContractError(f"reason must be text of at most {MAX_REASON} characters")
        return cls(aid, decision, float(relevance), category, reason)


def assessment_schema() -> dict:
    """JSON Schema of an evaluator's reply, for a model's structured-output mode. Assessment.parse enforces the same rules."""
    return {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "title": "BoughtAssessments",
        "type": "object",
        "additionalProperties": False,
        "required": ["assessments"],
        "properties": {"assessments": {"type": "array", "items": {
            "type": "object",
            "additionalProperties": False,
            "required": sorted(_FIELDS),
            "properties": {
                "article_id": {"type": "string"},
                "decision": {"enum": list(DECISIONS)},
                "relevance": {"type": "number", "minimum": 0, "maximum": 1},
                "category": {"enum": [*CATEGORIES, None]},
                "reason": {"type": "string", "maxLength": MAX_REASON},
            },
        }}},
    }


@dataclass(frozen=True)
class ImageAsset:
    """One picture with where it came from and how to credit it. A picture without this record is not used."""
    provider: str        # commons | publisher | library
    url: str
    page_url: str
    title: str
    author: str
    license: str         # short name, e.g. "CC BY-SA 4.0"
    license_url: str
    path: str            # local file; for a video clip, a folder of numbered frames
    width: int
    height: int
    phash: str
    frames: int = 0      # above 0 this is a video clip

    @property
    def credit(self) -> str:
        if self.provider == "library":
            return ""
        if self.provider == "publisher":
            return f"Photo: {self.author}"[:90]
        where = {"commons": "Wikimedia Commons"}.get(self.provider, self.provider)
        kind = "File video" if self.frames else "File photo"
        text = " · ".join(x for x in (f"{kind}: {self.author}" if self.author else kind, self.license, where) if x)
        return text if len(text) <= 90 else text[:87].rsplit(" ", 1)[0] + "..."

    def to_json(self) -> dict:
        return {**asdict(self), "credit": self.credit}
