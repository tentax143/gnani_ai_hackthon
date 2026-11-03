"""Everything Likhit says aloud, per interface language."""

MESSAGES = {
    "hi": {
        "welcome": "नमस्ते। लिखित में आपका स्वागत है। परीक्षा: {title}। कुल {n} प्रश्न, समय {m} मिनट। "
                   "उत्तर बोलने के लिए स्पेस दबाकर रखें और बोलें, फिर छोड़ दें। आदेश देने के लिए C दबाकर रखें। "
                   "मदद के लिए H दबाएँ।",
        "question": "प्रश्न {n}। {text} अंक {marks}।",
        "written": "लिखा गया: {text}",
        "heard_nothing": "कुछ सुनाई नहीं दिया। कृपया फिर से बोलिए।",
        "line": "लाइन {n}: {text}",
        "answer_empty": "प्रश्न {q} का उत्तर अभी खाली है।",
        "answer_intro": "प्रश्न {q} का उत्तर, {count} लाइनें।",
        "deleted": "लाइन {n} हटा दी गई: {text}",
        "replaced": "बदल दिया। लाइन {n} अब है: {text}",
        "not_found": "{old}, उत्तर में नहीं मिला।",
        "no_line": "लाइन {n} नहीं है। उत्तर में {count} लाइनें हैं।",
        "undone": "पिछला बदलाव वापस ले लिया।",
        "nothing_to_undo": "वापस लेने के लिए कोई बदलाव नहीं है।",
        "first_question": "यह पहला प्रश्न है।",
        "last_question": "यह आखिरी प्रश्न है।",
        "no_question": "प्रश्न {n} नहीं है। कुल {total} प्रश्न हैं।",
        "time_left": "{m} मिनट {s} सेकंड बचे हैं।",
        "help": "स्पेस दबाकर रखें: उत्तर बोलें। C दबाकर रखें: आदेश बोलें। "
                "R: उत्तर सुनें। Q: प्रश्न दोबारा। N: अगला प्रश्न। P: पिछला प्रश्न। U: अनडू। T: समय। "
                "प्लस और माइनस: बोलने की गति। Escape: चुप। "
                "आदेश के उदाहरण: तीसरी लाइन में काम को नाम करो। आखिरी लाइन हटाओ। लाइन दो पढ़ो। प्रश्न चार पर जाओ। उत्तर जमा करो।",
        "submit_confirm": "{total} में से {answered} प्रश्नों के उत्तर दिए गए हैं। क्या आप उत्तर जमा करना चाहते हैं? "
                          "C दबाकर हाँ या नहीं बोलिए।",
        "submitted": "आपके उत्तर जमा हो गए। धन्यवाद, और शुभकामनाएँ।",
        "cancelled": "ठीक है, जमा नहीं किया।",
        "already_submitted": "उत्तर पहले ही जमा हो चुके हैं।",
        "time_up": "समय समाप्त। आपके उत्तर जमा कर दिए गए हैं।",
        "unknown": "आदेश समझ नहीं आया: {text}। मदद के लिए H दबाएँ।",
        "error": "माफ़ कीजिए, कुछ गड़बड़ हुई। कृपया फिर से कोशिश करें।",
    },
    "en": {
        "welcome": "Hello, and welcome to Likhit. Exam: {title}. {n} questions, {m} minutes. "
                   "Hold the space bar and speak to write your answer, then release. Hold C to give a command. "
                   "Press H for help.",
        "question": "Question {n}. {text} Marks: {marks}.",
        "written": "Written: {text}",
        "heard_nothing": "I did not hear anything. Please speak again.",
        "line": "Line {n}: {text}",
        "answer_empty": "The answer to question {q} is empty.",
        "answer_intro": "Answer to question {q}, {count} lines.",
        "deleted": "Deleted line {n}: {text}",
        "replaced": "Changed. Line {n} now reads: {text}",
        "not_found": "{old} was not found in the answer.",
        "no_line": "There is no line {n}. The answer has {count} lines.",
        "undone": "Undid the last change.",
        "nothing_to_undo": "There is nothing to undo.",
        "first_question": "This is the first question.",
        "last_question": "This is the last question.",
        "no_question": "There is no question {n}. There are {total} questions.",
        "time_left": "{m} minutes {s} seconds left.",
        "help": "Hold space: speak your answer. Hold C: speak a command. "
                "R: hear your answer. Q: repeat the question. N: next question. P: previous question. U: undo. "
                "T: time left. Plus and minus: speaking speed. Escape: stop speaking. "
                "Example commands: replace cat with bat in line three. Delete last line. Read line two. "
                "Go to question four. Submit.",
        "submit_confirm": "You have answered {answered} of {total} questions. Do you want to submit? "
                          "Hold C and say yes or no.",
        "submitted": "Your answers have been submitted. Thank you, and all the best.",
        "cancelled": "Okay, not submitted.",
        "already_submitted": "Your answers are already submitted.",
        "time_up": "Time is up. Your answers have been submitted.",
        "unknown": "I did not understand the command: {text}. Press H for help.",
        "error": "Sorry, something went wrong. Please try again.",
    },
}


def say(lang: str, key: str, **kw) -> str:
    table = MESSAGES.get(lang.split("-")[0], MESSAGES["en"])
    return table[key].format(**kw)
