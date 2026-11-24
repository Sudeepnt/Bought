"""Load and validate config.yaml / sources.yaml."""
from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from pathlib import Path

import yaml

PKG_DIR = Path(__file__).resolve().parent
SOURCE_TYPES = ("rss", "sitemap", "tldr")


class ConfigError(ValueError):
    pass


@dataclass(frozen=True)
class Source:
    name: str
    type: str
    url: str
    weight: int
    category: str
    image_rights: str = "use"          # use = its picture may go on its card; link_only = never (for a publisher who objects)
    title_from_summary: bool = False   # a feed whose titles are bare product names: use "Name: tagline" as the headline
    always_on_brief: bool = False      # the whole feed is what we want, so it skips the keyword check (Product Hunt: every item is a launch)

    @property
    def slug(self) -> str:
        return re.sub(r"[^a-z0-9]+", "-", self.name.lower()).strip("-")


@dataclass(frozen=True)
class Config:
    user_agent: str = "BoughtNewsBot/0.1"
    http_timeout_seconds: float = 15
    fetch_attempts: int = 3
    max_items_per_source: int = 60
    max_age_hours: float = 48
    filtered_size: int = 50
    slots: dict = field(default_factory=lambda: {"prime": 25, "cards": 25, "glance": 10})
    category_cap: float = 0.4
    category_balance_max_bonus: float = 2.0
    dedupe_jaccard: float = 0.7
    og_fallback: bool = True
    og_min_interval_seconds: float = 1.5
    og_max_per_source: int = 15
    ingest_reject_future: bool = False         # building a past date's issue: anything published after that date is left out
    # Phase 2a: audio for prime stories. tts_command reads the script on stdin and writes {wav}.
    media_enabled: bool = False
    tts_command: tuple = ()
    tts_timeout_seconds: float = 120
    tts_voices: tuple = ()                     # the newsroom's voices; the stories take turns ({voice} in tts_command)
    tts_speed: float = 1.0                     # {speed} for story audio (the podcast has podcast_speed)
    audio_base_url: str = "/media"
    media_time_budget_seconds: float = 900     # keeps a 30-min cron from overlapping itself
    media_max_attempts: int = 3
    script_max_chars: int = 600
    # The daily podcast: every story in one narrated episode (needs media_enabled for the TTS engine).
    podcast_enabled: bool = False
    podcast_stories: int = 50
    podcast_speed: float = 1.0
    podcast_gap_seconds: float = 0.7
    podcast_time_budget_seconds: float = 1500
    # Translations for the page's language picker. translate_command reads a JSON list on stdin and prints a JSON list
    # ({lang} is replaced by the language code); see translate_m2m.py. Locales are the picker's, e.g. hi-IN, es-ES, ar.
    translate_languages: tuple = ()
    translate_command: tuple = ()
    translate_timeout_seconds: float = 1800
    translate_time_budget_seconds: float = 3000
    # Badges on stories (see badges.py). Off by default; the "most" badges need engagement_file from the page's collector.
    badges_enabled: bool = False
    badges_exclusive_sources: tuple = ()
    badges_new_hours: float = 3
    badges_min_events: int = 30
    badges_max_per_type: int = 3           # AI / New go to the first few stories only, so badges stay special
    engagement_file: str = ""
    # The source -> video funnel (funnel/README.md). Videos are explainers drawn by code (pipeline/explainer/README.md).
    funnel_video_count: int = 10               # stories that get an explainer video, from the top of the issue
    funnel_time_budget_seconds: float = 5400   # a build stops starting new stories after this; rerun to continue
    funnel_publisher_images: bool = True       # the article's own picture on its card (never in a video). Each issue lists these in rights_review.json
    funnel_voices: tuple = ("af_heart", "am_michael", "bf_emma", "af_nova", "am_adam", "bf_isabella", "af_bella", "bm_george", "af_sky", "am_liam",
                            "af_kore", "bm_lewis", "af_jessica", "am_eric", "bf_lily", "af_river", "am_onyx", "bf_alice", "af_sarah", "bm_daniel")
    # jev: the model that decides which stories run and in which section. Empty = rules only. See funnel/contracts.py for what it may answer.
    funnel_evaluator_command: tuple = ()
    funnel_evaluator_version: str = "1"        # bump to ask again after changing the model or its prompt
    funnel_evaluator_max_candidates: int = 300 # the best stories by rule score; the rest are not sent
    funnel_evaluator_batch: int = 40
    funnel_evaluator_timeout_seconds: float = 300
    # The explainer engine (pipeline/explainer/). The only AI: one Claude Haiku call per story through the Batch API (the scene plan),
    # and the local Kokoro voice. No key, or the call fails: a plan made by rules, so a video is always possible.
    explainer_model: str = "claude-haiku-5-5"
    explainer_batch_wait_seconds: float = 5400     # how long a build waits for the overnight batch before using the rules' plan
    explainer_batch_poll_seconds: float = 30
    explainer_duration_s: tuple = (60, 90)         # what the plan aims for; the voice decides the real length
    explainer_scenes: tuple = (4, 7)
    explainer_fps: int = 30
    explainer_music_db: float = -27                # the music bed under the voice; it ducks further while someone speaks
    explainer_ratios: tuple = ("9x16", "16x9")
    explainer_tts_command: tuple = ()              # Kokoro reading many lines in one run (explainer/kokoro_lines.py); {voice} {speed}


def expand_arg(arg: str) -> str:
    """Commands name their tools as ~/... or $BOUGHT_HOME/..., so one config.yaml works on a laptop and on the server.
    {wav}, {lang} and the other placeholders are left for the step that runs the command."""
    arg = re.sub(r"\$(\w+)|\$\{(\w+)\}", lambda m: os.environ.get(m.group(1) or m.group(2), DEFAULTS.get(m.group(1) or m.group(2), m.group(0))), arg)
    return os.path.expanduser(arg) if arg.startswith("~") else arg


DEFAULTS = {"BOUGHT_HOME": os.path.expanduser("~/.cache/bought")}


def load_config(path=None) -> Config:
    path = Path(path) if path else PKG_DIR / "config.yaml"
    raw = yaml.safe_load(path.read_text()) or {}
    unknown = set(raw) - set(Config.__dataclass_fields__)
    if unknown:
        raise ConfigError(f"unknown config keys: {sorted(unknown)}")
    for key in ("tts_voices", "translate_languages", "funnel_voices"):
        if isinstance(raw.get(key), list):
            raw[key] = tuple(map(str, raw[key]))
    for key in ("tts_command", "translate_command", "funnel_evaluator_command", "explainer_tts_command"):
        if isinstance(raw.get(key), list):
            raw[key] = tuple(expand_arg(str(a)) for a in raw[key])
    if isinstance(raw.get("badges_exclusive_sources"), list):
        raw["badges_exclusive_sources"] = tuple(map(str, raw["badges_exclusive_sources"]))
    for key in ("explainer_duration_s", "explainer_scenes", "explainer_ratios"):
        if isinstance(raw.get(key), list):
            raw[key] = tuple(raw[key])
    cfg = Config(**raw)
    if set(cfg.slots) != {"prime", "cards", "glance"} or any(
        not isinstance(n, int) or n < 0 for n in cfg.slots.values()
    ):
        raise ConfigError("slots must define non-negative ints for prime, cards, glance")
    if not 0 < cfg.category_cap <= 1:
        raise ConfigError("category_cap must be in (0, 1]")
    if not set(cfg.explainer_ratios) <= {"9x16", "16x9"} or not cfg.explainer_ratios:
        raise ConfigError("explainer_ratios must be 9x16 and/or 16x9")
    if cfg.translate_languages and not cfg.translate_command:
        raise ConfigError("translate_languages needs translate_command")
    if cfg.podcast_enabled and not cfg.tts_command:
        raise ConfigError("podcast_enabled needs tts_command")
    if cfg.media_enabled and not cfg.tts_command:
        raise ConfigError("media_enabled needs tts_command")
    return cfg


def load_sources(path=None) -> list:
    path = Path(path) if path else PKG_DIR / "sources.yaml"
    raw = yaml.safe_load(path.read_text()) or {}
    out, seen = [], set()
    for i, s in enumerate(raw.get("sources") or []):
        try:
            src = Source(
                name=str(s["name"]).strip(), type=str(s["type"]).strip().lower(),
                url=str(s["url"]).strip(), weight=int(s["weight"]),
                category=str(s["category"]).strip(), image_rights=str(s.get("image_rights", "use")).strip(),
                title_from_summary=bool(s.get("title_from_summary", False)), always_on_brief=bool(s.get("always_on_brief", False)),
            )
        except KeyError as e:
            raise ConfigError(f"sources[{i}] is missing {e}") from None
        if src.type not in SOURCE_TYPES:
            raise ConfigError(f"{src.name}: type must be one of {SOURCE_TYPES}")
        if src.image_rights not in ("use", "link_only"):
            raise ConfigError(f"{src.name}: image_rights must be use or link_only")
        if not 1 <= src.weight <= 5:
            raise ConfigError(f"{src.name}: weight must be 1-5")
        if not src.name or not src.category or not src.url.startswith(("http://", "https://")):
            raise ConfigError(f"sources[{i}]: name, category and an http(s) url are required")
        if src.name in seen:
            raise ConfigError(f"duplicate source name: {src.name}")
        seen.add(src.name)
        out.append(src)
    return out
