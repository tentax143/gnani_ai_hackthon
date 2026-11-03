"""An answer is a list of numbered lines that the student edits by voice."""

import re
import unicodedata

NUKTA = "़"

# Split after sentence-ending punctuation: Devanagari danda, ?, !, and "." not inside a number.
_SENTENCE_END = re.compile(r"(?<=[।॥?!])\s+|(?<=[^\d]\.)\s+")


def split_sentences(text: str) -> list[str]:
    text = unicodedata.normalize("NFC", text.strip())
    parts = [p.strip() for p in _SENTENCE_END.split(text)]
    return [p for p in parts if p]


def _fold(s: str) -> str:
    # Length-preserving, so a match in the folded string maps back onto the original.
    return s.lower().replace("ँ", "ं")


def _find(needle: str, haystack: str) -> re.Match | None:
    """Find `needle` ignoring case, chandrabindu/anusvara and nukta differences.

    The spoken command goes through a separate STT call, so "पाँच" in the answer
    may come back as "पांच" in the command.
    """
    needle = _fold(unicodedata.normalize("NFC", needle)).replace(NUKTA, "")
    pattern = "".join(re.escape(c) + f"{NUKTA}?" for c in needle)
    return re.search(pattern, _fold(haystack))


class EditError(Exception):
    """An edit that cannot be applied, e.g. line 7 of a 3-line answer."""


class Answer:
    def __init__(self, lines: list[str] | None = None):
        self.lines: list[str] = list(lines or [])
        self._history: list[list[str]] = []

    def _snapshot(self):
        self._history.append(list(self.lines))

    def _index(self, line_no: int) -> int:
        if line_no == -1 and self.lines:
            return len(self.lines) - 1
        if not 1 <= line_no <= len(self.lines):
            raise EditError(f"no line {line_no}; answer has {len(self.lines)} lines")
        return line_no - 1

    def append(self, text: str) -> list[int]:
        """Add dictated text as new lines; returns the new 1-based line numbers."""
        sentences = split_sentences(text)
        if not sentences:
            return []
        self._snapshot()
        start = len(self.lines)
        self.lines.extend(sentences)
        return list(range(start + 1, len(self.lines) + 1))

    def line(self, line_no: int) -> str:
        return self.lines[self._index(line_no)]

    def delete(self, line_no: int) -> str:
        idx = self._index(line_no)
        self._snapshot()
        return self.lines.pop(idx)

    def replace(self, old: str, new: str, line_no: int | None = None) -> int:
        """Replace `old` with `new`, in one line or in the last line that contains it.

        Returns the 1-based line number that changed.
        """
        old = old.strip()
        if not old:
            raise EditError("nothing to replace")
        if line_no is not None:
            candidates = [self._index(line_no)]
        else:
            candidates = range(len(self.lines) - 1, -1, -1)
        for idx in candidates:
            line = self.lines[idx]
            m = _find(old, line)
            if m:
                self._snapshot()
                self.lines[idx] = line[: m.start()] + new.strip() + line[m.end() :]
                return idx + 1
        where = f"line {line_no}" if line_no is not None else "the answer"
        raise EditError(f"'{old}' not found in {where}")

    def undo(self) -> bool:
        if not self._history:
            return False
        self.lines = self._history.pop()
        return True

    @property
    def text(self) -> str:
        return " ".join(self.lines)
