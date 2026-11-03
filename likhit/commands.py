"""Deterministic parser for spoken edit/navigation commands.

Prisma returns Hindi in Devanagari, Hinglish in either script, and English in
Latin, so every keyword is listed in all three forms. Deterministic on purpose:
in an exam the scribe must never invent an edit the student did not ask for.
"""

import re
import unicodedata
from dataclasses import dataclass, field

N = "़?"  # optional nukta: Prisma may or may not emit it (पढ़ / पढ)

_NUMBERS = {
    # cardinals
    "एक": 1, "दो": 2, "तीन": 3, "चार": 4, "पांच": 5, "छह": 6, "छः": 6, "सात": 7, "आठ": 8, "नौ": 9, "दस": 10,
    "ek": 1, "do": 2, "teen": 3, "tin": 3, "char": 4, "chaar": 4, "paanch": 5, "panch": 5, "chhe": 6, "che": 6,
    "saat": 7, "sat": 7, "aath": 8, "nau": 9, "das": 10,
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
    # ordinals
    "पहली": 1, "पहला": 1, "पहले": 1, "दूसरी": 2, "दूसरा": 2, "दूसरे": 2, "तीसरी": 3, "तीसरा": 3, "तीसरे": 3,
    "चौथी": 4, "चौथा": 4, "चौथे": 4, "पांचवी": 5, "पांचवीं": 5, "पांचवा": 5, "छठी": 6, "छठा": 6,
    "सातवीं": 7, "सातवी": 7, "आठवीं": 8, "आठवी": 8, "नौवीं": 9, "नौवी": 9, "दसवीं": 10, "दसवी": 10,
    "pehli": 1, "pahli": 1, "pehla": 1, "doosri": 2, "dusri": 2, "doosra": 2, "teesri": 3, "tisri": 3,
    "teesra": 3, "chauthi": 4, "chautha": 4, "paanchvi": 5, "chhathi": 6,
    "first": 1, "second": 2, "third": 3, "fourth": 4, "fifth": 5, "sixth": 6, "seventh": 7, "eighth": 8,
    "ninth": 9, "tenth": 10,
}
_LAST = r"(?:आखिरी|आख़िरी|अंतिम|आखरी|last|aakhri|akhri|aakhiri|antim)"

LINE = r"(?:लाइन|लाईन|पंक्ति|line|lain|pankti)"
QUESTION = r"(?:प्रश्न|सवाल|क्वेश्चन|question|prashn|prashna|sawal|savaal)"
NUM = r"(?:\d+|" + "|".join(sorted(map(re.escape, _NUMBERS), key=len, reverse=True)) + ")"
LINE_REF = rf"(?:{LINE}\s*(?:नंबर|number|no)?\s*(?P<n1>{NUM})|(?P<n2>{NUM})\s*(?:वीं|वी|वां)?\s*{LINE}|(?P<last>{_LAST})\s+{LINE})"

DO = r"(?:करो|कर दो|कर दीजिए|कीजिए|कर|बदलो|बदल दो|से बदलो|लिखो|karo|kar do|kar dijiye|badlo|badal do|likho)"
# पधो / पडो: Prisma's spelling when "padho" is said with an English-ish accent
_PADH = rf"(?:पढ{N}|पड{N}|पध)"
READ = rf"(?:{_PADH}ो|{_PADH}िए|{_PADH}ें|{_PADH} के सुनाओ|{_PADH} कर सुनाओ|सुनाओ|सुनाइए|padho|padh ke sunao|sunao|read|read back|read out)"
DELETE = r"(?:हटाओ|हटा दो|मिटाओ|मिटा दो|डिलीट करो|डिलीट|काटो|hatao|hata do|mitao|mita do|delete|remove|erase)"


@dataclass
class Command:
    intent: str
    args: dict = field(default_factory=dict)


def normalize(text: str) -> str:
    text = unicodedata.normalize("NFC", text).lower()
    text = text.replace("ँ", "ं")
    text = re.sub(r"[।॥,?!\"'“”‘’:;]", " ", text)
    text = re.sub(r"(?<!\d)\.|\.(?!\d)", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def to_int(token: str | None) -> int | None:
    if token is None:
        return None
    token = token.strip()
    if token.isdigit():
        return int(token)
    return _NUMBERS.get(token)


def _line_no(m: re.Match) -> int | None:
    if m.groupdict().get("last"):
        return -1
    return to_int(m.groupdict().get("n1") or m.groupdict().get("n2"))


_RULES: list[tuple[str, re.Pattern]] = [
    # "तीसरी लाइन में काम को नाम करो" / "line 3 mein kaam ko naam karo" / "काम को नाम कर दो"
    ("replace", re.compile(rf"^(?:{LINE_REF}\s+(?:में|मे|mein|me|main)\s+)?(?P<old>.+?)\s+(?:को|ko)\s+(?P<new>.+?)\s+{DO}$")),
    # "काम की जगह नाम लिखो"
    ("replace", re.compile(rf"^(?:{LINE_REF}\s+(?:में|मे|mein|me|main)\s+)?(?P<old>.+?)\s+(?:की जगह|ki jagah|ke badle|के बदले)\s+(?P<new>.+?)\s+{DO}$")),
    # "replace cat with bat in line 2" / "change cat to bat"
    ("replace", re.compile(rf"^(?:replace|change)\s+(?P<old>.+?)\s+(?:with|to|by)\s+(?P<new>.+?)(?:\s+in\s+{LINE_REF})?$")),
    ("delete_line", re.compile(rf"^(?:{DELETE}\s+)?{LINE_REF}(?:\s+(?:को|ko))?(?:\s+{DELETE})?$")),
    ("next_question", re.compile(rf"^(?:अगला|अगले|next|agla|agle)\s+{QUESTION}(?:\s+(?:पर|par|pe))?(?:\s+(?:जाओ|चलो|jao|chalo|go))?$|^next$|^अगला$")),
    ("prev_question", re.compile(rf"^(?:पिछला|पिछले|previous|pichhla|pichla|pichhle)\s+{QUESTION}(?:\s+(?:पर|par|pe))?(?:\s+(?:जाओ|चलो|jao|chalo|go))?$|^previous$|^पिछला$")),
    ("goto_question", re.compile(rf"^(?:go to\s+)?{QUESTION}\s*(?:नंबर|number|no)?\s*(?P<n1>{NUM})\s*(?:पर|par|pe)?\s*(?:जाओ|चलो|jao|chalo)?$")),
    ("repeat_question", re.compile(rf"^(?:{QUESTION}\s+(?:दोबारा|फिर से|फिर|dobara|phir se|again)(?:\s+{READ})?|(?:repeat|दोहराओ|dohrao)(?:\s+(?:the\s+)?{QUESTION})?|{QUESTION}\s+{READ}|read\s+(?:the\s+)?{QUESTION})$")),
    ("read_line", re.compile(rf"^(?:read\s+)?{LINE_REF}(?:\s+{READ})?$")),
    ("read_all", re.compile(rf"^(?:(?:पूरा|सारा|poora|pura|sara)\s+)?(?:(?:उत्तर|जवाब|answer|jawab|uttar)\s+)?{READ}(?:\s+(?:the\s+)?(?:answer|उत्तर|जवाब))?$")),
    ("undo", re.compile(r"^(?:undo|अनडू|वापस करो|वापस|पहले जैसा करो|पहले जैसा कर दो|wapas karo|wapas|pehle jaisa karo)$")),
    ("time_left", re.compile(r"^(?:कितना समय बचा(?: है)?|समय कितना बचा(?: है)?|time left|how much time(?: is)? left|kitna time bacha(?: hai)?|kitna samay bacha(?: hai)?|समय|time)$")),
    ("help", re.compile(r"^(?:मदद|हेल्प|help|madad|सहायता)$")),
    ("submit", re.compile(r"^(?:(?:उत्तर|answers?|पेपर|paper)\s+)?(?:जमा करो|जमा कर दो|सबमिट करो|सबमिट|submit|jama karo|jama kar do)$")),
    ("confirm", re.compile(r"^(?:हां|हाँ|हा|जी हां|yes|haan|han|ha|confirm|ठीक है|theek hai|ok|okay)$")),
    ("cancel", re.compile(r"^(?:नहीं|नही|no|nahi|nahin|cancel|रहने दो|rehne do)$")),
]


def parse(text: str) -> Command:
    t = normalize(text)
    for intent, pattern in _RULES:
        m = pattern.match(t)
        if not m:
            continue
        if intent == "replace":
            line_no = _line_no(m) if any(m.groupdict().get(k) for k in ("n1", "n2", "last")) else None
            return Command("replace", {"old": m["old"], "new": m["new"], "line": line_no})
        if intent in ("delete_line", "read_line"):
            line_no = _line_no(m)
            if line_no is None:
                continue
            return Command(intent, {"line": line_no})
        if intent == "goto_question":
            n = to_int(m["n1"])
            if n is None:
                continue
            return Command(intent, {"question": n})
        return Command(intent)
    return Command("unknown", {"text": text})
