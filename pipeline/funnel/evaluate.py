"""Stage "consider": which stories run, and in which section.

  RuleEvaluator     always on, no model: drops promotions and anything off the brief, and files the rest by keyword.
  CommandEvaluator  jev. Any program (funnel_evaluator_command): gets JSON on stdin, prints JSON matching contracts.assessment_schema().
                    Off until set. It answers one question: can we have this news, is it really for Bought, and where does it go.
                    Its answers decide the final list. A reply that breaks the contract is thrown away and the rules stand for that batch.

jev sees only stories the rules kept, so nothing is sent for promotions or off-brief items. Each answer is stored with its
evaluator and input hash, so it is not asked twice and can be audited. Everything after this stage runs without a model.
"""
from __future__ import annotations

import hashlib
import json
import logging
import re
import subprocess
from typing import Protocol

from ..db import transaction
from .contracts import CONTRACT_VERSION, Assessment, Candidate, ContractError, assessment_schema

log = logging.getLogger(__name__)

SCHEMA = """
CREATE TABLE IF NOT EXISTS assessments (
    article_id TEXT NOT NULL,
    evaluator  TEXT NOT NULL,                  -- name@version
    input_hash TEXT NOT NULL,
    decision   TEXT NOT NULL,
    relevance  REAL NOT NULL,
    category   TEXT,
    reason     TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (article_id, evaluator, input_hash)
);
"""

_DROP = [
    (r"\b(sponsored|sponsor|partner content|advertorial)\b", "promotion"),
    (r"\b(best|top) \d* ?[\w\s-]{0,40}\bdeals?\b|\bdeals? (of|on|for)\b|\b\d+% off\b|\bbest .{0,30} to buy\b|\bpromo codes?\b|\bprime day\b|\bblack friday\b", "shopping"),
    (r"\b(save|get|register|tickets?|passes?) .{0,40}\b(disrupt|summit|conference)\b|\bearly[- ]bird\b|\bdoors open\b|\b(summit|disrupt) 20\d\d\b|\bregister now\b", "event promotion"),
    (r"\bour (favorite|favourite)\b|\bgift guide\b|\bhow to watch\b|\bpodcast:|\bnewsletter\b|\bcrossword\b|^the download\b|\bweekday newsletter\b|\bprovided by\b|\bproduced by .{0,40}(insights|studio)\b", "not news"),
]

class Evaluator(Protocol):
    name: str
    version: str

    def assess(self, candidates: list) -> list:
        """Candidates in, one Assessment per candidate out. Raises ContractError (or OSError) if it cannot answer."""
        ...


class RuleEvaluator:
    name, version = "rules", "3"

    def __init__(self, brief, exempt=frozenset()):
        self.brief, self.exempt = brief, exempt        # exempt: sources whose whole feed is on brief

    def assess(self, candidates: list) -> list:
        return [self._one(c) for c in candidates]

    def _one(self, c: Candidate) -> Assessment:
        text = f"{c.headline}. {c.summary}"
        for pattern, why in _DROP:
            if re.search(pattern, text, re.I):
                return Assessment(c.id, "drop", 0.5, None, why)
        if c.source in self.exempt:
            return Assessment(c.id, "keep", 0.5, c.category, "")
        section = self.brief.section_for(c.headline, c.summary, c.category)
        return Assessment(c.id, "keep", 0.5, section, "") if section else Assessment(c.id, "drop", 0.5, None, "off brief")


class CommandEvaluator:
    """Runs jev. stdin: {contract_version, schema, brief, candidates}. stdout: {"assessments": [...]}."""
    name = "jev"

    def __init__(self, command, version="1", timeout=300, brief=None):
        self.command, self.version, self.timeout, self.brief = list(command), str(version), timeout, brief

    def assess(self, candidates: list) -> list:
        ask = {"contract_version": CONTRACT_VERSION, "schema": assessment_schema(), "brief": self.brief.to_json() if self.brief else None, "candidates": [c.to_json() for c in candidates]}
        try:
            run = subprocess.run(self.command, input=json.dumps(ask).encode(), capture_output=True, check=True, timeout=self.timeout)
            reply = json.loads(run.stdout)
        except (subprocess.SubprocessError, ValueError) as e:
            raise ContractError(f"evaluator failed: {type(e).__name__}") from None
        if not isinstance(reply, dict) or set(reply) != {"assessments"} or not isinstance(reply["assessments"], list):
            raise ContractError('reply must be exactly {"assessments": [...]}')
        ids = [c.id for c in candidates]
        out = [Assessment.parse(a, ids) for a in reply["assessments"]]
        if sorted(a.article_id for a in out) != sorted(ids):
            raise ContractError("reply must answer every story exactly once")
        return out


def _input_hash(c: Candidate) -> str:
    return hashlib.sha1(json.dumps([CONTRACT_VERSION, c.headline, c.summary, c.category]).encode()).hexdigest()[:12]


def _ask(conn, evaluator, candidates, now_iso, batch) -> dict:
    """Assessments per id, from the store where we already asked. A failed batch simply has no answers: the rules stand."""
    tag = f"{evaluator.name}@{evaluator.version}"
    found, todo = {}, []
    for c in candidates:
        r = conn.execute("SELECT * FROM assessments WHERE article_id=? AND evaluator=? AND input_hash=?", (c.id, tag, _input_hash(c))).fetchone()
        if r:
            found[c.id] = Assessment(c.id, r["decision"], r["relevance"], r["category"], r["reason"])
        else:
            todo.append(c)
    for start in range(0, len(todo), batch):
        part = todo[start:start + batch]
        try:
            answers = evaluator.assess(part)
        except (ContractError, OSError) as e:
            log.warning("evaluator %s: %d stories fall back to the rules (%s)", tag, len(part), e)
            continue
        by_id = {c.id: c for c in part}
        with transaction(conn):
            conn.executemany("INSERT OR REPLACE INTO assessments VALUES (?,?,?,?,?,?,?,?)",
                             [(a.article_id, tag, _input_hash(by_id[a.article_id]), a.decision, a.relevance, a.category, a.reason, now_iso) for a in answers])
        found.update({a.article_id: a for a in answers})
    return found


def consider(conn, cfg, now_iso: str, brief, exempt=frozenset(), model=None) -> dict:
    """Rules, then jev if set. Applies drops and sections; returns {id: relevance} for stories jev answered."""
    conn.executescript(SCHEMA)
    rows = conn.execute("SELECT * FROM articles WHERE status='new' OR status LIKE 'selected_%'").fetchall()
    cands = [Candidate(r["id"], r["title"], r["summary"], r["source"], r["category"], r["published_at"], r["canonical_url"]) for r in rows]
    rules = _ask(conn, RuleEvaluator(brief, exempt), cands, now_iso, 1000)
    weights = {r["id"]: r["source_weight"] for r in rows}
    survivors = [c for c in cands if rules[c.id].decision == "keep"]
    survivors = sorted(survivors, key=lambda c: (-weights[c.id], c.published_at, c.id))[:cfg.funnel_evaluator_max_candidates]
    opinions = _ask(conn, model, survivors, now_iso, cfg.funnel_evaluator_batch) if model else {}
    drops, moves, relevance = [], [], {}
    for c in cands:
        r, m = rules[c.id], opinions.get(c.id)
        if r.decision == "drop":
            drops.append((f"rules:{r.reason}", c.id))
        elif m and m.decision == "drop":
            drops.append((f"{model.name}:{m.reason}"[:200], c.id))
        else:
            section = (m.category if m else None) or r.category
            if section and section != c.category:
                moves.append((section, c.id))
            if m:
                relevance[c.id] = m.relevance
    with transaction(conn):
        conn.executemany("UPDATE articles SET status='rejected', reject_reason=? WHERE id=?", drops)
        conn.executemany("UPDATE articles SET category=? WHERE id=?", moves)
    return relevance


def build_model(cfg, brief=None):
    return CommandEvaluator(cfg.funnel_evaluator_command, cfg.funnel_evaluator_version, cfg.funnel_evaluator_timeout_seconds, brief) if cfg.funnel_evaluator_command else None
