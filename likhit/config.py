import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

DATA_DIR = ROOT / "data"
CACHE_DIR = DATA_DIR / "cache"
SESSIONS_DIR = DATA_DIR / "sessions"
PAPERS_DIR = ROOT / "papers"
STATIC_DIR = ROOT / "static"


def api_key() -> str:
    # The .env uses `api=`; GNANI_API_KEY is accepted too.
    key = os.getenv("GNANI_API_KEY") or os.getenv("api") or ""
    return key.strip().strip('"').strip("'")


STT_MODEL = os.getenv("LIKHIT_STT_MODEL", "prisma-v3.0")
TTS_MODEL = os.getenv("LIKHIT_TTS_MODEL", "timbre-v3.0")
TTS_VOICE = os.getenv("LIKHIT_TTS_VOICE", "Shivani")
