"""FastAPI app: serves the eyes-free exam UI and wraps Gnani Prisma and Timbre."""

from contextlib import asynccontextmanager
from html import escape

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, HTMLResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import config, scribe
from .commands import parse
from .gnani import GnaniClient, GnaniError
from .session import Session, list_papers, verify_log

sessions: dict[str, Session] = {}
gnani: GnaniClient


@asynccontextmanager
async def lifespan(app: FastAPI):
    global gnani
    gnani = GnaniClient()
    yield
    await gnani.close()


app = FastAPI(title="Likhit", lifespan=lifespan)


def _session(session_id: str) -> Session:
    s = sessions.get(session_id)
    if not s:
        raise HTTPException(404, "session not found")
    return s


def _reply(s: Session, speech: list[str], **extra) -> dict:
    items = [{"text": str(t), "line": getattr(t, "line", None)} for t in speech]
    return {"speech": items, "state": s.snapshot(), **extra}


class StartRequest(BaseModel):
    paper: str
    student: str = ""


@app.get("/api/papers")
def papers():
    return list_papers()


@app.post("/api/session")
def start(req: StartRequest):
    try:
        s = Session(req.paper, req.student.strip()[:80])
    except FileNotFoundError:
        raise HTTPException(404, "paper not found")
    sessions[s.id] = s
    return _reply(s, scribe.welcome_speech(s))


@app.get("/api/session/{session_id}")
def state(session_id: str):
    s = _session(session_id)
    return _reply(s, scribe.expire_if_due(s))


async def _transcribe(s: Session, audio: UploadFile, for_command: bool) -> str:
    wav = await audio.read()
    q = s.question
    try:
        result = await gnani.transcribe(
            wav,
            s.paper.get("stt_languages", s.language),
            topic=None if for_command else q.get("topic") or q["text"],
            keyterms=None if for_command else q.get("keyterms"),
            previous_text=None if for_command else (s.answer.text or None),
        )
    except GnaniError as e:
        raise HTTPException(502, str(e))
    return result.text


@app.post("/api/session/{session_id}/dictate")
async def dictate(session_id: str, audio: UploadFile = File(...)):
    s = _session(session_id)
    if expired := scribe.expire_if_due(s):
        return _reply(s, expired)
    text = await _transcribe(s, audio, for_command=False)
    return _reply(s, scribe.dictate(s, text), transcript=text)


@app.post("/api/session/{session_id}/command")
async def command(session_id: str, audio: UploadFile | None = File(None), text: str | None = Form(None)):
    """A spoken command (audio) or a key press mapped to command text."""
    s = _session(session_id)
    if expired := scribe.expire_if_due(s):
        return _reply(s, expired)
    extra = {}
    if audio is not None:
        text = await _transcribe(s, audio, for_command=True)
        extra["transcript"] = text  # only spoken commands were "heard"; key presses were not
    if not text:
        return _reply(s, [scribe.say(s.language, "heard_nothing")], **extra)
    cmd = parse(text)
    return _reply(s, scribe.execute(s, cmd), intent=cmd.intent, **extra)


@app.get("/api/tts")
async def tts(text: str, lang: str = "hi-IN", speed: float = 1.0):
    if not text.strip() or len(text) > 2000:
        raise HTTPException(400, "text must be 1-2000 characters")
    try:
        wav = await gnani.synthesize(text, lang, speed)
    except GnaniError as e:
        raise HTTPException(502, str(e))
    return Response(wav, media_type="audio/wav", headers={"Cache-Control": "private, max-age=86400"})


@app.get("/export/{session_id}", response_class=HTMLResponse)
def export(session_id: str):
    """Printable answer sheet. The browser shapes Indic scripts; print to PDF from there."""
    s = _session(session_id)
    ok, final = verify_log(s.log_path)
    blocks = []
    for i, (q, a) in enumerate(zip(s.paper["questions"], s.answers), 1):
        lines = "".join(f"<li>{escape(l)}</li>" for l in a.lines) or "<li class='empty'>—</li>"
        blocks.append(f"<section><h2>{i}. {escape(q['text'])} <small>({q.get('marks', '')})</small></h2><ol>{lines}</ol></section>")
    status = "verified" if ok else "LOG TAMPERED"
    return f"""<!doctype html><html lang="{s.language[:2]}"><meta charset="utf-8">
<title>Likhit answer sheet {s.id}</title><link rel="stylesheet" href="/static/sheet.css">
<header><h1>{escape(s.paper['title'])}</h1>
<p>Student: {escape(s.student or '—')} · Session {s.id} · Written with Likhit (Gnani Prisma + Timbre)</p></header>
{''.join(blocks)}
<footer><p>Audit log: {status} · SHA-256 {final}</p>
<p>Every dictation and edit is recorded in a hash-chained log. Recompute with <code>python -m likhit.verify {s.id}</code>.</p></footer>
</html>"""


@app.get("/")
def index():
    return FileResponse(config.STATIC_DIR / "index.html")


app.mount("/static", StaticFiles(directory=config.STATIC_DIR), name="static")
