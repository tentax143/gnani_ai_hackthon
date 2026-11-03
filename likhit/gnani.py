"""Thin async client for Gnani Prisma (STT) and Timbre (TTS).

Calls are serialised behind a lock and retried on 429, because some accounts
allow only one active request at a time. TTS output is cached on disk so
repeated prompts ("Question one", help text) cost no credits.
"""

import asyncio
import hashlib
import json
from dataclasses import dataclass

import httpx

from . import config

STT_URL = "https://api.vachana.ai/stt/v3"
TTS_URL = "https://api.vachana.ai/api/v1/tts/inference"


class GnaniError(Exception):
    pass


@dataclass
class Transcript:
    text: str
    language: str | None
    request_id: str | None
    latency: float | None


class GnaniClient:
    def __init__(self, key: str | None = None, retries: int = 4):
        self.key = key if key is not None else config.api_key()
        self.retries = retries
        self._lock = asyncio.Lock()
        self._http = httpx.AsyncClient(timeout=60)
        config.CACHE_DIR.mkdir(parents=True, exist_ok=True)

    async def close(self):
        await self._http.aclose()

    async def _post(self, url: str, **kwargs) -> httpx.Response:
        if not self.key:
            raise GnaniError("No Gnani API key: set `api=` or GNANI_API_KEY in .env")
        headers = {"X-API-Key-ID": self.key}
        delay = 0.5
        async with self._lock:
            for attempt in range(self.retries + 1):
                resp = await self._http.post(url, headers=headers, **kwargs)
                if resp.status_code != 429 or attempt == self.retries:
                    return resp
                await asyncio.sleep(delay)
                delay *= 2
        raise AssertionError("unreachable")

    async def transcribe(
        self,
        wav: bytes,
        languages: str = "hi-IN,en-IN",
        *,
        fmt: str = "transcribe",
        topic: str | None = None,
        keyterms: list[str] | None = None,
        previous_text: str | None = None,
    ) -> Transcript:
        data = {"model": config.STT_MODEL, "language_code": languages, "format": fmt}
        if topic:
            data["topic"] = topic[:1600]
        if keyterms:
            data["keyterms"] = json.dumps(keyterms[:200], ensure_ascii=False)
        if previous_text:
            data["previous_text"] = previous_text[-600:]
        resp = await self._post(
            STT_URL, files={"audio_file": ("clip.wav", wav, "audio/wav")}, data=data
        )
        body = _json(resp)
        if resp.status_code != 200 or not body.get("success"):
            raise GnaniError(f"STT failed ({resp.status_code}): {_error_message(body)}")
        return Transcript(
            text=(body.get("transcript") or "").strip(),
            language=body.get("detected_language_code"),
            request_id=body.get("request_id"),
            latency=body.get("end_to_end_latency"),
        )

    async def synthesize(self, text: str, language: str = "hi-IN", speed: float = 1.0) -> bytes:
        speed = round(min(1.15, max(0.85, speed)), 2)
        payload = {
            "text": text,
            "voice": config.TTS_VOICE,
            "model": config.TTS_MODEL,
            "language": language,
            "speed": speed,
            "audio_config": {
                "sample_rate": 24000,
                "num_channels": 1,
                "sample_width": 2,
                "encoding": "linear_pcm",
                "container": "wav",
            },
        }
        cache_key = hashlib.sha256(json.dumps(payload, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
        cached = config.CACHE_DIR / f"{cache_key}.wav"
        if cached.exists():
            return cached.read_bytes()
        resp = await self._post(TTS_URL, json=payload)
        if resp.status_code != 200 or not resp.headers.get("content-type", "").startswith("audio"):
            raise GnaniError(f"TTS failed ({resp.status_code}): {_error_message(_json(resp))}")
        cached.write_bytes(resp.content)
        return resp.content


def _json(resp: httpx.Response) -> dict:
    try:
        return resp.json()
    except ValueError:
        return {"message": resp.text[:300]}


def _error_message(body: dict) -> str:
    err = body.get("error") or body.get("detail") or body
    if isinstance(err, dict):
        return str(err.get("message") or err.get("type") or err)
    return str(err)
