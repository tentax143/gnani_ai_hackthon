"""An exam session: the paper, one Answer per question, and a tamper-evident log.

Every event is appended to a JSONL file whose entries are hash-chained
(each entry stores the SHA-256 of the previous one), so an invigilator can
verify that the exported sheet is exactly what the student dictated and edited.
"""

import hashlib
import json
import secrets
import time
from pathlib import Path

from . import config
from .answer import Answer

GENESIS = "0" * 64


def load_paper(paper_id: str) -> dict:
    path = (config.PAPERS_DIR / f"{paper_id}.json").resolve()
    if not path.is_file() or path.parent != config.PAPERS_DIR.resolve():
        raise FileNotFoundError(paper_id)
    return json.loads(path.read_text(encoding="utf-8"))


def list_papers() -> list[dict]:
    papers = []
    for path in sorted(config.PAPERS_DIR.glob("*.json")):
        p = json.loads(path.read_text(encoding="utf-8"))
        papers.append({"id": path.stem, "title": p["title"], "language": p["language"],
                       "questions": len(p["questions"]), "minutes": p["minutes"]})
    return papers


def entry_hash(prev: str, entry: dict) -> str:
    body = json.dumps(entry, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256((prev + body).encode()).hexdigest()


def verify_log(path: Path) -> tuple[bool, str]:
    """Recompute the chain; returns (ok, final hash)."""
    prev = GENESIS
    for raw in path.read_text(encoding="utf-8").splitlines():
        record = json.loads(raw)
        claimed = record.pop("hash")
        if record.get("prev") != prev or entry_hash(prev, record) != claimed:
            return False, prev
        prev = claimed
    return True, prev


class Session:
    def __init__(self, paper_id: str, student: str = "", session_id: str | None = None):
        self.id = session_id or secrets.token_hex(6)
        self.paper_id = paper_id
        self.paper = load_paper(paper_id)
        self.student = student
        self.answers = [Answer() for _ in self.paper["questions"]]
        self.current = 0
        self.started = time.time()
        self.submitted_at: float | None = None
        self.pending_submit = False
        self.last_hash = GENESIS
        config.SESSIONS_DIR.mkdir(parents=True, exist_ok=True)
        self.log_path = config.SESSIONS_DIR / f"{self.id}.jsonl"
        self.log("start", paper=paper_id, student=student)

    # -- paper helpers -------------------------------------------------------
    @property
    def language(self) -> str:
        return self.paper["language"]

    @property
    def question(self) -> dict:
        return self.paper["questions"][self.current]

    @property
    def answer(self) -> Answer:
        return self.answers[self.current]

    def seconds_left(self) -> int:
        end = self.started + self.paper["minutes"] * 60
        return max(0, int(end - (self.submitted_at or time.time())))

    def goto(self, index: int) -> bool:
        if not 0 <= index < len(self.answers):
            return False
        self.current = index
        self.log("goto", question=index + 1)
        return True

    # -- audit log -----------------------------------------------------------
    def log(self, event: str, **data):
        entry = {"t": round(time.time(), 3), "event": event, "q": self.current + 1,
                 "prev": self.last_hash, **data}
        self.last_hash = entry_hash(self.last_hash, entry)
        with self.log_path.open("a", encoding="utf-8") as f:
            f.write(json.dumps({**entry, "hash": self.last_hash}, ensure_ascii=False) + "\n")

    def snapshot(self) -> dict:
        return {
            "id": self.id,
            "paper": {"id": self.paper_id, "title": self.paper["title"], "language": self.language,
                      "minutes": self.paper["minutes"]},
            "student": self.student,
            "current": self.current,
            "total": len(self.answers),
            "question": self.question,
            "lines": self.answer.lines,
            "answered": [bool(a.lines) for a in self.answers],
            "seconds_left": self.seconds_left(),
            "submitted": self.submitted_at is not None,
            "pending_submit": self.pending_submit,
            "log_hash": self.last_hash,
        }
