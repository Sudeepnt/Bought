"""Which of the 20 themes each video gets. Automatic, in this order:
  1. the desk's choice for that story (an admin override), if there is one;
  2. the story's section picks a pool of themes that suit it (AI, Tech, Business, Founders, Launch, Geopolitics);
  3. the weekday's edition colour comes first in that pool when it belongs there (Thursday = Frontier, Friday = Launch Day ...);
  4. the section's stories take turns through the pool, and two stories in a row never share a theme.
The same issue always gets the same themes."""
from __future__ import annotations

from datetime import date as Date

SECTIONS = {"AI": "AI", "Technology": "Technology", "Tech business": "Business", "Founders & startups": "Founders",
            "Product launches": "Launches", "Tech geopolitics": "Geopolitics"}
POOLS = {
    "AI": ["frontier", "big-number", "chip-lab", "night-desk"],
    "Technology": ["night-desk", "chip-lab", "morning-paper", "orbit", "broadsheet"],
    "Business": ["money-edition", "market-desk", "versus", "broadsheet"],
    "Founders": ["builders", "people", "morning-paper", "long-read"],
    "Launches": ["launch-day", "phone-launch", "orbit", "radio-ember"],
    "Geopolitics": ["geopolitics", "map-room", "network", "red-pen"],
}
# The paper's weekday editions (public/js/data.template.js): Monday = 0
WEEKDAY = {0: "broadsheet", 1: "builders", 2: "money-edition", 3: "frontier", 4: "launch-day", 5: "long-read", 6: "geopolitics"}


def section(item: dict) -> str:
    return SECTIONS.get(item.get("category"), item.get("category") if item.get("category") in POOLS else "Technology")


def choose(items: list, date: str, overrides: dict | None = None, known=None) -> dict:
    """{story id: theme id} for the stories in page order."""
    overrides = overrides or {}
    known = set(known) if known else None
    edition = WEEKDAY[Date.fromisoformat(date).weekday()]
    seen, out, prev = {}, {}, None
    for item in items:
        sid = item["id"]
        if overrides.get(sid) and (known is None or overrides[sid] in known):
            out[sid] = prev = overrides[sid]
            continue
        sec = section(item)
        pool = list(POOLS[sec])
        if edition in pool:
            pool.remove(edition)
            pool.insert(0, edition)
        if known is not None:
            pool = [t for t in pool if t in known] or sorted(known)
        k = seen.get(sec, 0)
        seen[sec] = k + 1
        pick = pool[k % len(pool)]
        if pick == prev:
            pick = next((t for t in pool[k % len(pool) + 1:] + pool if t != prev), pick)
            if pick == prev:                                      # a pool of one: borrow from all the themes
                pick = next(t for t in (sorted(known) if known else [x for p in POOLS.values() for x in p]) if t != prev)
        out[sid] = prev = pick
    return out
