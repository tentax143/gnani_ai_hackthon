"""Applies dictation and parsed commands to a session and decides what to say back."""

import time

from .answer import EditError
from .commands import Command
from .messages import say
from .session import Session


class LineSpeech(str):
    """An utterance about one answer line, so the UI can highlight it while it plays."""

    def __new__(cls, text: str, line: int):
        obj = super().__new__(cls, text)
        obj.line = line
        return obj


def _line(s: Session, key: str, n: int, **kw) -> LineSpeech:
    return LineSpeech(say(s.language, key, n=n, **kw), n)


def _lines_speech(s: Session, lines: list[str], numbers: list[int]) -> list[str]:
    return [_line(s, "line", n, text=t) for n, t in zip(numbers, lines)]


def question_speech(s: Session) -> list[str]:
    q = s.question
    return [say(s.language, "question", n=s.current + 1, text=q["text"], marks=q.get("marks", ""))]


def welcome_speech(s: Session) -> list[str]:
    p = s.paper
    return [say(s.language, "welcome", title=p["title"], n=len(p["questions"]), m=p["minutes"])] + question_speech(s)


def read_answer(s: Session) -> list[str]:
    lines = s.answer.lines
    if not lines:
        return [say(s.language, "answer_empty", q=s.current + 1)]
    intro = say(s.language, "answer_intro", q=s.current + 1, count=len(lines))
    return [intro] + _lines_speech(s, lines, list(range(1, len(lines) + 1)))


def dictate(s: Session, text: str) -> list[str]:
    if s.submitted_at:
        return [say(s.language, "already_submitted")]
    numbers = s.answer.append(text)
    if not numbers:
        return [say(s.language, "heard_nothing")]
    s.log("dictate", text=text, lines=numbers)
    return [say(s.language, "written", text=text)]


def _submit(s: Session) -> list[str]:
    s.pending_submit = False
    s.submitted_at = min(time.time(), s.started + s.paper["minutes"] * 60)
    s.log("submit", answers=[a.lines for a in s.answers])
    return [say(s.language, "submitted")]


def expire_if_due(s: Session) -> list[str]:
    if s.submitted_at is None and s.seconds_left() == 0:
        _submit(s)
        return [say(s.language, "time_up")]
    return []


def execute(s: Session, cmd: Command) -> list[str]:
    lang = s.language
    if s.submitted_at:
        return [say(lang, "already_submitted")]

    if s.pending_submit:
        if cmd.intent == "confirm":
            return _submit(s)
        s.pending_submit = False
        if cmd.intent == "cancel":
            s.log("submit_cancelled")
            return [say(lang, "cancelled")]

    a = s.answer
    try:
        match cmd.intent:
            case "replace":
                n = a.replace(cmd.args["old"], cmd.args["new"], cmd.args["line"])
                s.log("replace", **cmd.args, result=a.lines[n - 1])
                return [_line(s, "replaced", n, text=a.lines[n - 1])]
            case "delete_line":
                n = cmd.args["line"]
                n = len(a.lines) if n == -1 else n
                removed = a.delete(n)
                s.log("delete", line=n, removed=removed)
                return [say(lang, "deleted", n=n, text=removed)]
            case "read_line":
                n = cmd.args["line"]
                n = len(a.lines) if n == -1 else n
                return [_line(s, "line", n, text=a.line(n))]
            case "read_all":
                return read_answer(s)
            case "undo":
                if a.undo():
                    s.log("undo", lines=a.lines)
                    return [say(lang, "undone")]
                return [say(lang, "nothing_to_undo")]
            case "next_question":
                if not s.goto(s.current + 1):
                    return [say(lang, "last_question")]
                return question_speech(s)
            case "prev_question":
                if not s.goto(s.current - 1):
                    return [say(lang, "first_question")]
                return question_speech(s)
            case "goto_question":
                n = cmd.args["question"]
                if not s.goto(n - 1):
                    return [say(lang, "no_question", n=n, total=len(s.answers))]
                return question_speech(s)
            case "repeat_question":
                return question_speech(s)
            case "time_left":
                m, sec = divmod(s.seconds_left(), 60)
                return [say(lang, "time_left", m=m, s=sec)]
            case "help":
                return [say(lang, "help")]
            case "submit":
                s.pending_submit = True
                answered = sum(bool(x.lines) for x in s.answers)
                return [say(lang, "submit_confirm", answered=answered, total=len(s.answers))]
            case "confirm" | "cancel":
                return [say(lang, "cancelled")]
            case _:
                heard = cmd.args.get("text", "")
                s.log("unknown_command", text=heard)
                return [say(lang, "unknown", text=heard.rstrip("।.?! "))]
    except EditError as e:
        if str(e).startswith("no line"):
            n = cmd.args.get("line")
            return [say(lang, "no_line", n=0 if n in (-1, None) else n, count=len(a.lines))]
        if cmd.intent == "replace":
            return [say(lang, "not_found", old=cmd.args["old"])]
        return [say(lang, "error")]
