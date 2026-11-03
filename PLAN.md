# Likhit (लिखित): a voice exam scribe for visually impaired students

> Entry for Gnani AI's **Great Indian AI Internship Challenge 2026**. Deadline: **Nov 10, 2026, 11:59 PM IST.**
> All data is synthetic: exam papers are made up, and audio is our own voice or Timbre-generated.

## 1. Problem

In Indian board, university and competitive exams, a visually impaired student usually needs a **human scribe**
to read the questions aloud and write down the answers. That causes real problems:

- The scribe may be hard to find, hired late, or mismatched in language or subject.
- The student cannot check what was actually written. They have to trust the scribe's handwriting and honesty.
- Correcting an answer means asking someone else to rewrite it, which is slow and embarrassing.
- The scribe reads aloud in one language, often not the student's own.

**Likhit gives the student back control of their own answer sheet.** Timbre reads the questions in the student's
language. The student dictates the answer, and Prisma transcribes it, including Hinglish. They hear it read back
line by line and fix it by voice ("तीसरी लाइन में काम को नाम करो"). The finished sheet is exported with a
tamper-evident log that an invigilator can verify.

## 2. Users

| User | Needs |
|---|---|
| Visually impaired student (primary) | Fully eyes-free: keyboard plus voice, audio feedback for every action, their own language, speed control |
| Invigilator / exam centre | A clean printable answer sheet, proof that the student made every edit, no internet surprises |
| Low-vision student | Large high-contrast text alongside audio |

## 3. Gnani models used

| Stage | Model | How |
|---|---|---|
| Read the question aloud and announce actions | **Timbre v3.0** (`timbre-v3.0`, voice Shivani; one voice covers all 10 languages) | REST with a disk cache, so repeated prompts cost no credits; `speed` 0.85–1.15 set by the student |
| Dictate the answer | **Prisma v3.0** (`prisma-v3.0`) | REST `/stt/v3` with `format=transcribe` (numbers become digits). Language hints such as `hi-IN,en-IN` handle Hinglish. `previous_text` carries context between chunks, and `topic` and `keyterms` come from the question so subject words come out right |
| Voice commands | **Prisma v3.0** | Same endpoint. The text goes to a deterministic multilingual command parser |
| (Phase 2) live captions | Prisma realtime WebSocket | Text appears while the student speaks |
| (Stretch) free-form commands | **Evon v3.3** (open weights), if a GPU is available | Fallback parser for commands the grammar misses. Optional, and the README says so honestly |

## 4. Architecture

```
Browser (static HTML/JS, keyboard + mic)          FastAPI server (Python)              Gnani APIs
┌──────────────────────────────────┐     WAV    ┌────────────────────────────┐   ┌──────────────────┐
│ hold Space → dictate             │ ─────────▶ │ /api/dictate  → Prisma     │──▶│ api.vachana.ai   │
│ hold C     → command             │ ─────────▶ │ /api/command  → parser     │   │  /stt/v3         │
│ R/Q/N/P/U/H keys                 │            │ answer.py (lines, undo)    │   │  /api/v1/tts/... │
│ AudioWorklet → 16 kHz mono WAV   │ ◀───────── │ /api/tts      → Timbre+cache│──▶│                  │
│ audio queue with barge-in        │   audio    │ session.py  (hash-chained  │   └──────────────────┘
│ aria-live + big-text view        │            │   audit log, JSON on disk) │
└──────────────────────────────────┘            │ /export/{id} printable sheet│
                                                └────────────────────────────┘
```

Key decisions:
- **WAV is built in the browser** (AudioWorklet, downsampled to 16 kHz). Chrome's MediaRecorder produces webm, which Prisma does not accept, and this means no ffmpeg is needed.
- **Recordings over 25 s are split on the client** and sent in order with `previous_text`, which stays within the 30 s REST limit.
- **Command parsing is deterministic**, not done by an LLM. It is predictable, testable, works offline, and in an exam it never "makes up" an edit.
- **Gnani calls run one at a time** behind a lock and retry on HTTP 429, because some accounts allow only one active request at a time.
- **The audit log is hash-chained JSONL.** Every dictation and edit is stored with a timestamp and the previous entry's hash, so the exported sheet carries a verification hash.
- **The export is printable HTML, not a generated PDF.** The browser shapes Indic scripts correctly, which reportlab does not. Print → Save as PDF.

## 5. Voice command grammar (Hindi, English, Hinglish)

| Intent | Examples |
|---|---|
| Read all | "पढ़ो", "पढ़ के सुनाओ", "read back", "sunao" |
| Read line N | "लाइन 3 पढ़ो", "तीसरी लाइन पढ़ो", "read line three" |
| Delete line N / last | "लाइन 2 हटाओ", "आखिरी लाइन मिटाओ", "delete last line" |
| Replace | "तीसरी लाइन में काम को नाम करो", "काम को नाम कर दो", "replace cat with bat in line 2" |
| Undo | "undo", "वापस करो", "पहले जैसा करो" |
| Next / previous / go to question | "अगला प्रश्न", "पिछला सवाल", "प्रश्न 4 पर जाओ", "next question" |
| Repeat question | "प्रश्न दोबारा पढ़ो", "repeat question" |
| Time left | "कितना समय बचा है", "time left" |
| Help | "मदद", "help" |
| Submit (asks for confirmation) | "उत्तर जमा करो", "submit" |

## 6. Keyboard map (eyes-free)

| Key | Action |
|---|---|
| **Space** (hold) | Dictate into the current answer; release to send |
| **C** (hold) | Speak a command |
| R | Read the current answer back, line by line |
| Q | Repeat the question |
| N / P | Next / previous question |
| U | Undo the last change |
| T | Time left |
| H | Spoken help |
| + / − | Speak faster / slower |
| Esc | Stop speaking (barge-in) |

## 7. Milestones

| Date | Milestone |
|---|---|
| Oct 30 | ✅ API smoke test. ✅ Gnani client, answer model, command parser, session plus audit log, server, browser UI, 54 tests. ✅ Server end-to-end run with real Prisma/Timbre audio |
| Oct 31 | Test in the browser with a real microphone; tune the grammar on real misrecognitions. **First LinkedIn post (build in public)** |
| Nov 1–2 | Full exam flow: start screen, questions, timer, submit, printable export plus audit log. English and Hinglish |
| Nov 3 | Second language for papers and prompts (Tamil or Kannada). **Second post** |
| Nov 4–5 | Phase 2: realtime streaming captions; noise test (phone mic, fan noise); small evaluation: command-parse accuracy on a synthetic set, STT on generated answers |
| Nov 6 | Accessibility pass. Ideally test with a screen-reader user, and if possible a visually impaired student (with consent) |
| Nov 7 | README with evidence (tests, eval numbers, limitations). **Third post** |
| Nov 8 | Record the 60-second demo (captions; show eyes-free use) |
| Nov 9 | Post the final demo on LinkedIn + X with #GreatIndianAIInternshipChallenge #GnaniAI and tag Gnani AI. Submit the form |
| Nov 10 | Buffer. Final edits close at 11:59 PM IST |

## 8. Award targets

Real Deal (real-world problem), Main Character (regional language), Mixed Vibes (Hinglish dictation),
Solo Ninja / Two-Person Army, Demo Day Drop (60-second video), Crowd Favourite.

## 9. Out of scope / honest limits

- Not a certified exam tool. A board would need its own approval.
- No real student data. Papers are synthetic.
- Evon is optional, because it is not on the API platform.
- The browser needs internet access for Gnani APIs; an offline mode is not planned.
