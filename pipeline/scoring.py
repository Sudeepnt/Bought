"""Stage 4: score candidates and pick the filtered set and the three slots (no LLM)."""
from __future__ import annotations

import math
from datetime import datetime, timedelta

from .db import SLOT_STATUS, transaction
from .ingest import iso, parse_iso


def recency_bonus(published_at: datetime, now: datetime, max_age_hours: float) -> float:
    """5.0 for brand new, falling linearly to 0.0 at max_age_hours."""
    age_h = max(0.0, (now - published_at).total_seconds() / 3600)
    return round(5.0 * max(0.0, 1.0 - age_h / max_age_hours), 4)


def base_score(weight: int, published_at: datetime, now: datetime, max_age_hours: float) -> float:
    return weight * 2 + recency_bonus(published_at, now, max_age_hours)


def pick_filtered(cands: list, size: int, max_bonus: float) -> list:
    """Greedy top-`size` by score + category_balance_bonus (categories under an even share get up to
    `max_bonus`). cands need: id, category, score, published_at. Returns the picked, in rank order."""
    cats = {c["category"] for c in cands}
    if not cats:
        return []
    target = max(1.0, size / len(cats))
    picked, counts, pool = [], {}, list(cands)
    while pool and len(picked) < size:
        def adjusted(c):
            under = max(0.0, 1.0 - counts.get(c["category"], 0) / target)
            return (c["score"] + max_bonus * under, c["published_at"], c["id"])
        best = max(pool, key=adjusted)
        pool.remove(best)
        picked.append(best)
        counts[best["category"]] = counts.get(best["category"], 0) + 1
    return picked


def pick_slot(ordered: list, n: int, cap_frac: float, prefer_not_in: set = frozenset()) -> list:
    """First `n` of `ordered`, at most floor(n*cap_frac) (min 1) per category, never the same story
    twice. Two passes: stories not already used elsewhere first, then reuse to fill the slot."""
    if n <= 0:
        return []
    cap = max(1, math.floor(n * cap_frac + 1e-9))
    chosen, counts = [], {}
    for allow_reuse in (False, True):
        for c in ordered:
            if len(chosen) >= n:
                break
            if any(x["id"] == c["id"] for x in chosen):
                continue
            if not allow_reuse and c["id"] in prefer_not_in:
                continue
            if counts.get(c["category"], 0) >= cap:
                continue
            chosen.append(c)
            counts[c["category"]] = counts.get(c["category"], 0) + 1
    return chosen


def pick_sections(cands: list, sections: dict) -> list:
    """The best stories of each section, up to its size. Unfilled seats stay empty: a section is never padded from another.
    Returned dealt in turn across the sections, best section first, so the top of the list (the videos) covers all of them."""
    queues = []
    for name, size in sections.items():
        mine = sorted((c for c in cands if c["category"] == name), key=lambda c: (-c["score"], c["published_at"], c["id"]))[:size]
        if mine:
            queues.append(mine)
    queues.sort(key=lambda q: -q[0]["score"])
    dealt = []
    while queues:
        for q in list(queues):
            dealt.append(q.pop(0))
            if not q:
                queues.remove(q)
    return dealt


def prefilter(conn, cfg, now: datetime, require_image: bool = True) -> None:
    """Expire stale items and reject image-less ones, before dedupe, so a no-image copy can't
    beat a usable duplicate. (Titles are required at ingest.)"""
    cutoff = iso(now - timedelta(hours=cfg.max_age_hours))
    with transaction(conn):
        conn.execute("UPDATE articles SET status='expired' WHERE published_at < ? AND status != 'expired'",
                     (cutoff,))
        if require_image:
            conn.execute("UPDATE articles SET status='rejected', reject_reason='no_image'"
                         " WHERE status='new' AND (image_url IS NULL OR image_url='')")


def select(conn, cfg, now: datetime, relevance: dict = None, sections: dict = None) -> dict:
    """Recompute everything from the live articles, replacing the previous selection atomically.
    relevance: optional {id: 0..1} from jev: stories it answered rank by its answer, ahead of any it did not.
    sections: optional {section: size}: fill these sections instead of the even balance and category cap."""
    with transaction(conn):
        conn.execute("UPDATE articles SET status='new' WHERE status LIKE 'selected_%'")
        conn.execute("DELETE FROM selections")
        live = [dict(r) for r in conn.execute(
            "SELECT id, category, source_weight, published_at FROM articles WHERE status='new' AND published_at<=?", (iso(now),))]
        for c in live:
            c["score"] = base_score(c["source_weight"], parse_iso(c["published_at"]), now, cfg.max_age_hours)
            if relevance and c["id"] in relevance:
                c["score"] = 100 + 100 * relevance[c["id"]]
        conn.executemany("UPDATE articles SET score=? WHERE id=?", [(c["score"], c["id"]) for c in live])

        if sections:
            top = pick_sections(live, sections)
            prime = top[:cfg.slots["prime"]]
            cards = top[cfg.slots["prime"]:cfg.slots["prime"] + cfg.slots["cards"]]
        else:
            top = pick_filtered(live, cfg.filtered_size, cfg.category_balance_max_bonus)
            prime = pick_slot(top, cfg.slots["prime"], cfg.category_cap)
            cards = pick_slot(top, cfg.slots["cards"], cfg.category_cap, prefer_not_in={c["id"] for c in prime})
        newest_first = sorted(top, key=lambda c: (c["published_at"], c["id"]), reverse=True)
        glance = pick_slot(newest_first, cfg.slots["glance"], cfg.category_cap)

        result = {"prime": prime, "cards": cards, "glance": glance}
        for slot, items in result.items():
            conn.executemany("INSERT INTO selections (slot, rank, article_id) VALUES (?,?,?)",
                             [(slot, i + 1, c["id"]) for i, c in enumerate(items)])
        for slot in ("glance", "cards", "prime"):  # strongest slot wins the single status value
            conn.executemany("UPDATE articles SET status=? WHERE id=?",
                             [(SLOT_STATUS[slot], c["id"]) for c in result[slot]])
    return {"candidates": len(live), "filtered": len(top), **{k: len(v) for k, v in result.items()}}
