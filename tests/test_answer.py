import pytest

from likhit.answer import Answer, EditError, split_sentences


def test_split_sentences_hindi_and_english():
    assert split_sentences("भारत की राजधानी दिल्ली है। यह बड़ा शहर है।") == [
        "भारत की राजधानी दिल्ली है।",
        "यह बड़ा शहर है।",
    ]
    assert split_sentences("Value is 3.5 units. Done") == ["Value is 3.5 units.", "Done"]


def test_append_numbers_new_lines():
    a = Answer()
    assert a.append("पहला वाक्य। दूसरा वाक्य।") == [1, 2]
    assert a.append("तीसरा") == [3]
    assert a.append("   ") == []


def test_replace_in_line_and_search_from_last():
    a = Answer(["काम अच्छा है।", "काम पूरा हुआ।"])
    assert a.replace("काम", "नाम") == 2  # latest occurrence first
    assert a.lines == ["काम अच्छा है।", "नाम पूरा हुआ।"]
    assert a.replace("काम", "नाम", line_no=1) == 1
    assert a.lines[0] == "नाम अच्छा है।"


def test_replace_tolerates_case_nukta_and_chandrabindu():
    a = Answer(["The Capital is Delhi.", "ज़िंदगी में पाँच बातें।"])
    a.replace("delhi", "Mumbai")
    assert a.lines[0] == "The Capital is Mumbai."
    a.replace("जिंदगी", "जीवन")  # command transcript without nukta
    a.replace("पांच", "छह")  # anusvara vs chandrabindu
    assert a.lines[1] == "जीवन में छह बातें।"


def test_last_line_and_errors():
    a = Answer(["a.", "b."])
    assert a.line(-1) == "b."
    with pytest.raises(EditError):
        a.delete(5)
    with pytest.raises(EditError):
        a.replace("zzz", "y")
    with pytest.raises(EditError):
        Answer().line(-1)


def test_undo_restores_previous_state():
    a = Answer()
    a.append("one. two.")
    a.delete(1)
    a.replace("two", "three")
    assert a.lines == ["three."]
    assert a.undo() and a.lines == ["two."]
    assert a.undo() and a.lines == ["one.", "two."]
    assert a.undo() and a.lines == []
    assert not a.undo()
