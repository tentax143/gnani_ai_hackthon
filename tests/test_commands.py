import pytest

from likhit.commands import parse


@pytest.mark.parametrize(
    "text, intent, args",
    [
        # replace, Hindi / Hinglish / English, with and without a line
        ("तीसरी लाइन में काम को नाम करो।", "replace", {"old": "काम", "new": "नाम", "line": 3}),
        ("लाइन 2 में राजा को रानी कर दो", "replace", {"old": "राजा", "new": "रानी", "line": 2}),
        ("काम को नाम कर दो", "replace", {"old": "काम", "new": "नाम", "line": None}),
        ("आखिरी लाइन में दिल्ली को मुंबई करो", "replace", {"old": "दिल्ली", "new": "मुंबई", "line": -1}),
        ("line 3 mein kaam ko naam karo", "replace", {"old": "kaam", "new": "naam", "line": 3}),
        ("teesri line mein photosynthesis ko respiration karo", "replace",
         {"old": "photosynthesis", "new": "respiration", "line": 3}),
        ("काम की जगह नाम लिखो", "replace", {"old": "काम", "new": "नाम", "line": None}),
        ("Replace cat with bat in line two.", "replace", {"old": "cat", "new": "bat", "line": 2}),
        ("change 3.5 to 4.5", "replace", {"old": "3.5", "new": "4.5", "line": None}),
        # delete
        ("लाइन 2 हटाओ", "delete_line", {"line": 2}),
        ("दूसरी लाइन मिटा दो", "delete_line", {"line": 2}),
        ("आखिरी लाइन हटाओ", "delete_line", {"line": -1}),
        ("delete line 4", "delete_line", {"line": 4}),
        ("delete last line", "delete_line", {"line": -1}),
        # read
        ("पढ़ के सुनाओ", "read_all", {}),
        ("पढ के सुनाओ", "read_all", {}),
        ("पूरा उत्तर पढ़ो", "read_all", {}),
        ("Read back.", "read_all", {}),
        ("sunao", "read_all", {}),
        ("लाइन 3 पढ़ो", "read_line", {"line": 3}),
        ("तीसरी लाइन पढ़ो", "read_line", {"line": 3}),
        ("read line three", "read_line", {"line": 3}),
        ("लाइन एक पधो।", "read_line", {"line": 1}),  # real Prisma output for "line 1 padho"
        # navigation
        ("अगला प्रश्न", "next_question", {}),
        ("अगले सवाल पर जाओ", "next_question", {}),
        ("Next question.", "next_question", {}),
        ("पिछला प्रश्न", "prev_question", {}),
        ("प्रश्न 4 पर जाओ", "goto_question", {"question": 4}),
        ("question number five", "goto_question", {"question": 5}),
        ("प्रश्न दोबारा पढ़ो", "repeat_question", {}),
        ("repeat question", "repeat_question", {}),
        ("सवाल पढ़ो", "repeat_question", {}),
        # misc
        ("वापस करो", "undo", {}),
        ("Undo.", "undo", {}),
        ("कितना समय बचा है?", "time_left", {}),
        ("time left", "time_left", {}),
        ("मदद", "help", {}),
        ("उत्तर जमा करो", "submit", {}),
        ("हाँ", "confirm", {}),
        ("नहीं", "cancel", {}),
    ],
)
def test_parse(text, intent, args):
    cmd = parse(text)
    assert cmd.intent == intent, (text, cmd)
    assert cmd.args == args


@pytest.mark.parametrize("text", ["भारत की राजधानी दिल्ली है", "the mitochondria", ""])
def test_dictation_like_text_is_unknown(text):
    assert parse(text).intent == "unknown"
