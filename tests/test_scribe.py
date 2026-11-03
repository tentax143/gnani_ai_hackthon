import json

import pytest

from likhit import config, scribe
from likhit.commands import parse
from likhit.session import Session, verify_log


@pytest.fixture(autouse=True)
def tmp_sessions(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "SESSIONS_DIR", tmp_path)


def run(s, text):
    return scribe.execute(s, parse(text))


def test_full_exam_flow_in_hindi():
    s = Session("sample_hi", "Roll 42")
    assert "प्रश्न 1" in scribe.welcome_speech(s)[-1]

    scribe.dictate(s, "प्रकाश संश्लेषण में पौधे भोजन बनाते हैं। इसके लिए धूप और पानी चाहिए।")
    assert len(s.answer.lines) == 2

    assert "लाइन 2 अब है" in run(s, "दूसरी लाइन में पानी को कार्बन डाइऑक्साइड करो")[0]
    assert s.answer.lines[1] == "इसके लिए धूप और कार्बन डाइऑक्साइड चाहिए।"

    assert run(s, "पढ़ के सुनाओ")[1].startswith("लाइन 1:")
    run(s, "वापस करो")
    assert "पानी" in s.answer.lines[1]

    assert "प्रश्न 2" in run(s, "अगला प्रश्न")[0]
    assert "खाली" in run(s, "पढ़ो")[0]
    assert "नहीं है" in run(s, "प्रश्न 9 पर जाओ")[0]

    assert "1 प्रश्नों" in run(s, "उत्तर जमा करो")[0]
    assert s.pending_submit
    run(s, "हाँ")
    assert s.snapshot()["submitted"]
    assert "पहले ही" in scribe.dictate(s, "late text")[0]

    ok, final = verify_log(s.log_path)
    assert ok and final == s.last_hash


def test_edit_errors_are_spoken_not_raised():
    s = Session("sample_en")
    scribe.dictate(s, "Diwali is a festival of lights.")
    assert "was not found" in run(s, "replace Holi with Eid")[0]
    assert "no line 5" in run(s, "delete line 5")[0].lower()
    assert "did not understand" in run(s, "make it better")[0]


def test_submit_cancel_returns_to_exam():
    s = Session("sample_en")
    run(s, "submit")
    assert run(s, "no")[0] == "Okay, not submitted."
    assert not s.pending_submit and not s.snapshot()["submitted"]


def test_tampering_breaks_the_chain():
    s = Session("sample_en")
    scribe.dictate(s, "Weather changes daily.")
    lines = s.log_path.read_text(encoding="utf-8").splitlines()
    entry = json.loads(lines[1])
    entry["text"] = "Something the student never said."
    lines[1] = json.dumps(entry, ensure_ascii=False)
    s.log_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    assert verify_log(s.log_path)[0] is False


def test_unknown_paper_and_path_traversal():
    with pytest.raises(FileNotFoundError):
        Session("../.env")
