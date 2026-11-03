"""Generate the demo video's voiceover with Gnani Timbre v3.0.

Writes public/vo/<id>.wav and src/vo.json (durations in seconds).
Run from the repo root:  .venv/Scripts/python video/scripts/voiceover.py
"""

import json
import sys
import wave
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from likhit import config  # noqa: E402

OUT = ROOT / "video" / "public" / "vo"
META = ROOT / "video" / "src" / "vo.json"

NARRATOR, LIKHIT, STUDENT = "Avinash", "Shivani", "Lakshmi"

CLIPS = [
    ("n1", NARRATOR, "en-IN", "In India, a blind student often writes their board exam through someone else's hand."),
    ("n2", NARRATOR, "en-IN", "If the scribe mishears, or changes a word, the student can never check what was written."),
    ("n3", NARRATOR, "en-IN", "Meet Likhit. A voice exam scribe, built on Gnani AI."),
    ("n4", NARRATOR, "en-IN", "Likhit reads every question aloud, in the student's own language."),
    ("l1", LIKHIT, "hi-IN", "प्रश्न एक। प्रकाश संश्लेषण क्या है? इसके लिए आवश्यक दो चीज़ें लिखिए।"),
    ("n5", NARRATOR, "en-IN", "The student just speaks. Hindi, English, or Hinglish. Gnani Prisma writes it down."),
    ("s1", STUDENT, "hi-IN", "हरे पौधे सूर्य के प्रकाश से भोजन बनाते हैं। इसके लिए क्लोरोफिल और पानी आवश्यक हैं।"),
    ("n6", NARRATOR, "en-IN", "Mistakes? Fix them by voice."),
    ("s2", STUDENT, "hi-IN", "दूसरी लाइन में पानी को कार्बन डाइऑक्साइड करो।"),
    ("l2", LIKHIT, "hi-IN", "बदल दिया। लाइन दो अब है: इसके लिए क्लोरोफिल और कार्बन डाइऑक्साइड आवश्यक हैं।"),
    ("n7", NARRATOR, "en-IN", "Likhit reads the answer back, line by line. No screen. No mouse. Just a keyboard and a voice."),
    ("n8", NARRATOR, "en-IN", "Every edit is sealed in a hash-chained log that the invigilator can verify."),
    ("n9", NARRATOR, "en-IN", "Likhit. Your words, exactly as you said them."),
]


def fix_header(path: Path) -> float:
    """Timbre streams WAV with a 0xFFFFFFFF data size; rewrite it with the real length."""
    with wave.open(str(path)) as w:
        params = w.getparams()
        frames = w.readframes(w.getnframes())
    with wave.open(str(path), "wb") as w:
        w.setnchannels(params.nchannels)
        w.setsampwidth(params.sampwidth)
        w.setframerate(params.framerate)
        w.writeframes(frames)
    n = len(frames) // (params.nchannels * params.sampwidth)
    return round(n / params.framerate, 3)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    key = config.api_key()
    meta = {}
    with httpx.Client(timeout=90, headers={"X-API-Key-ID": key}) as http:
        for cid, voice, lang, text in CLIPS:
            path = OUT / f"{cid}.wav"
            if not path.exists() or "--force" in sys.argv:
                resp = http.post(
                    "https://api.vachana.ai/api/v1/tts/inference",
                    json={
                        "text": text, "voice": voice, "model": config.TTS_MODEL, "language": lang, "speed": 1.1,
                        "audio_config": {"sample_rate": 24000, "num_channels": 1, "sample_width": 2,
                                         "encoding": "linear_pcm", "container": "wav"},
                    },
                )
                if resp.status_code != 200 or not resp.headers.get("content-type", "").startswith("audio"):
                    sys.exit(f"{cid}: TTS failed {resp.status_code} {resp.text[:300]}")
                path.write_bytes(resp.content)
            meta[cid] = fix_header(path)
            print(f"{cid:3} {voice:8} {meta[cid]:6.2f}s  {text}")
    META.write_text(json.dumps(meta, indent=2))
    print("total", round(sum(meta.values()), 1), "s")


if __name__ == "__main__":
    main()
