"""Charts for the desk, drawn on the server as SVG (no chart library, no outside script). Hover tooltips come from
`data-tip` on each mark's hit area and the small script in dash_pages.TIP_JS.

Colours (validated for colour-blind readers against the desk's card colour #fbf8f1): series 1 blue, series 2 orange.
"""
from __future__ import annotations

import math
from datetime import date as Date
from html import escape as e

S1, S2 = "#2a78d6", "#eb6834"
GRID, BASE, MUTED = "#e4ddcf", "#c9c0ae", "#857f74"


def nice_max(v: float) -> tuple[float, float]:
    """A round top for the axis and its step, so gridlines land on numbers people read at a glance."""
    if v <= 0:
        return 4, 1
    raw = v / 4
    mag = 10 ** math.floor(math.log10(raw))
    step = next(m * mag for m in (1, 2, 2.5, 5, 10) if m * mag >= raw)
    step = max(step, 1)
    return step * math.ceil(v / step), step


def num(v) -> str:
    if v is None:
        return "–"
    if isinstance(v, float) and not v.is_integer():
        return f"{v:,.1f}"
    v = int(v)
    if abs(v) >= 1_000_000:
        return f"{v / 1e6:.1f}M".replace(".0M", "M")
    if abs(v) >= 10_000:
        return f"{v / 1e3:.0f}k"
    return f"{v:,}"


def short_day(d: str) -> str:
    x = Date.fromisoformat(d)
    return f"{x.day} {x.strftime('%b')}"


def long_day(d: str) -> str:
    x = Date.fromisoformat(d)
    return f"{x.strftime('%a')} {x.day} {x.strftime('%b')}"


def _col(x, y, w, h, r=4) -> str:
    """A column with a rounded top and a square foot on the baseline."""
    if h <= 0:
        return ""
    r = min(r, w / 2, h)
    return f"M{x:.1f},{y + h:.1f}V{y + r:.1f}Q{x:.1f},{y:.1f} {x + r:.1f},{y:.1f}H{x + w - r:.1f}Q{x + w:.1f},{y:.1f} {x + w:.1f},{y + r:.1f}V{y + h:.1f}Z"


def _frame(top, step, W, H, L, R, T, B, fmt=num) -> str:
    out = []
    v = 0
    while v <= top + 1e-9:
        y = T + (H - T - B) * (1 - v / top)
        out.append(f'<line x1="{L}" x2="{W - R}" y1="{y:.1f}" y2="{y:.1f}" stroke="{BASE if v == 0 else GRID}" stroke-width="1"/>'
                   f'<text x="{L - 8}" y="{y + 4:.1f}" text-anchor="end" class="ax">{fmt(v)}</text>')
        v += step
    return "".join(out)


def columns(points: list, series: list[tuple[str, str]], tip, title: str, height=220, label_every=None, mark=None, width=1100) -> str:
    """Daily (or hourly) columns, stacked when there are two series.
    points: [(x_label_key, [v1, v2...])]; series: [(name, colour)]; tip(key, values) -> text; mark: index to flag (e.g. publish hour)."""
    W, H, L, R, T, B = width, height, 44, 8, 12, 26
    n = len(points)
    totals = [sum(v) for _, v in points]
    top, step = nice_max(max(totals) if totals else 0)
    band = (W - L - R) / max(n, 1)
    bw = min(24, band * 0.7)
    every = label_every or max(1, math.ceil(n / 8))
    parts = [_frame(top, step, W, H, L, R, T, B)]
    for i, (key, vals) in enumerate(points):
        x = L + band * i + (band - bw) / 2
        base = H - B
        segs = []
        for j, v in enumerate(vals):
            h = (H - T - B) * v / top if top else 0
            if h <= 0:
                continue
            y = base - h
            foot = base - (2 if segs else 0)             # a 2px surface gap where a segment sits on another
            if all(w <= 0 for w in vals[j + 1:]):        # the top segment gets the rounded end
                path = _col(x, y, bw, foot - y)
            else:
                path = f"M{x:.1f},{foot:.1f}V{y:.1f}H{x + bw:.1f}V{foot:.1f}Z"
            segs.append(f'<path d="{path}" fill="{series[j][1]}"/>')
            base = y
        flag = f'<line x1="{L + band * i + band / 2:.1f}" x2="{L + band * i + band / 2:.1f}" y1="{T}" y2="{H - B}" stroke="{MUTED}" stroke-width="1"/>' if mark == i else ""
        label = f'<text x="{L + band * i + band / 2:.1f}" y="{H - 8}" text-anchor="middle" class="ax">{e(str(key if not isinstance(key, str) or len(key) != 10 else short_day(key)))}</text>' if (i % every == 0 and n - 1 - i >= every / 2) or i == n - 1 else ""
        parts.append(f'<g class="col">{flag}<rect class="hl" x="{L + band * i:.1f}" y="{T}" width="{band:.1f}" height="{H - T - B}"/>{"".join(segs)}{label}'
                     f'<rect class="hit" x="{L + band * i:.1f}" y="0" width="{band:.1f}" height="{H}" data-tip="{e(tip(key, vals))}"/></g>')
    return f'<div class="cw{" half" if W < 800 else ""}"><svg class="chart" viewBox="0 0 {W} {H}" role="img" aria-label="{e(title)}">{"".join(parts)}</svg></div>'


def line(points: list[tuple[str, float]], tip, title: str, colour=S1, height=200, width=1100) -> str:
    """One series over time: a 2px line, a light wash under it, an end dot with its value, and a crosshair on hover."""
    W, H, L, R, T, B = width, height, 44, 46, 14, 26
    n = len(points)
    vals = [v for _, v in points]
    top, step = nice_max(max(vals) if vals else 0)
    xs = [L + (W - L - R) * (i / max(n - 1, 1)) for i in range(n)]
    ys = [T + (H - T - B) * (1 - v / top) for v in vals]
    d = "M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in zip(xs, ys))
    area = d + f" L{xs[-1]:.1f},{H - B} L{xs[0]:.1f},{H - B} Z" if n else ""
    every = max(1, math.ceil(n / 8))
    labels = "".join(f'<text x="{x:.1f}" y="{H - 8}" text-anchor="middle" class="ax">{e(short_day(k))}</text>' for i, ((k, _), x) in enumerate(zip(points, xs)) if (i % every == 0 and n - 1 - i >= every / 2) or i == n - 1)
    band = (W - L - R) / max(n - 1, 1)
    hits = "".join(f'<g class="pt"><line x1="{x:.1f}" x2="{x:.1f}" y1="{T}" y2="{H - B}" stroke="{MUTED}" stroke-width="1"/><circle cx="{x:.1f}" cy="{y:.1f}" r="5" fill="{colour}" stroke="#fbf8f1" stroke-width="2"/>'
                   f'<rect class="hit" x="{x - band / 2:.1f}" y="0" width="{band:.1f}" height="{H}" data-tip="{e(tip(k, v))}"/></g>' for (k, v), x, y in zip(points, xs, ys))
    end = f'<circle cx="{xs[-1]:.1f}" cy="{ys[-1]:.1f}" r="4.5" fill="{colour}" stroke="#fbf8f1" stroke-width="2"/><text x="{xs[-1] + 9:.1f}" y="{ys[-1] + 4:.1f}" class="val">{num(vals[-1])}</text>' if n else ""
    return (f'<div class="cw{" half" if W < 800 else ""}"><svg class="chart" viewBox="0 0 {W} {H}" role="img" aria-label="{e(title)}">{_frame(top, step, W, H, L, R, T, B)}'
            f'<path d="{area}" fill="{colour}" fill-opacity=".1"/><path d="{d}" fill="none" stroke="{colour}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>{end}{labels}{hits}</svg></div>')


def spark(values: list[float], colour=S1) -> str:
    """A tiny trend line for a stat tile. Decoration beside a number, so it has no axis and no tooltip."""
    if len(values) < 2 or not any(values):
        return ""
    W, H = 120, 28
    top = max(values) or 1
    pts = [(W * i / (len(values) - 1), 2 + (H - 4) * (1 - v / top)) for i, v in enumerate(values)]
    d = "M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in pts)
    return f'<svg class="spark" viewBox="0 0 {W} {H}" aria-hidden="true"><path d="{d}" fill="none" stroke="{colour}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>'


def bars(items: list[tuple[str, float]], tip=None, colour=S1, limit=8, other=True) -> str:
    """Horizontal bars, biggest first, value at the tip. Past `limit`, the rest fold into Other."""
    items = list(items)
    if other and len(items) > limit:
        rest = sum(v for _, v in items[limit - 1:])
        items = items[:limit - 1] + [("Other", rest)]
    if not items:
        return '<p class="empty">Nothing yet.</p>'
    top = max(v for _, v in items) or 1
    total = sum(v for _, v in items) or 1
    rows = "".join(
        f'<div class="hb" data-tip="{e(tip(k, v) if tip else f"{k}: {num(v)} ({v / total:.0%})")}"><span class="hb-l">{e(str(k))}</span>'
        f'<span class="hb-t"><i style="width:{max(v / top * 100, 0.8):.1f}%;background:{colour}"></i><b>{num(v)}</b></span></div>' for k, v in items)
    return f'<div class="hbars">{rows}</div>'


def funnel(steps: list[tuple[str, float]], colour=S1) -> str:
    """Each step as a bar against the first, with what share of the step before it got through."""
    if not steps or not steps[0][1]:
        return '<p class="empty">Nothing scraped yet.</p>'
    first = steps[0][1]
    rows = []
    for i, (label, v) in enumerate(steps):
        prev = steps[i - 1][1] if i else None
        kept = f"{v / prev:.0%} of the step before" if prev else "everything fetched"
        rows.append(f'<div class="hb fn" data-tip="{e(f"{label}: {v:,} · {kept}")}"><span class="hb-l">{e(label)}</span>'
                    f'<span class="hb-t"><i style="width:{max(v / first * 100, 0.8):.1f}%;background:{colour}"></i><b>{num(v)}</b>'
                    f'{f"<small>{v / prev:.0%}</small>" if prev else ""}</span></div>')
    return f'<div class="hbars">{"".join(rows)}</div>'
