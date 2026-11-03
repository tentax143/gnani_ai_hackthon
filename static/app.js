import { Recorder, Speaker, earcon } from "./audio.js";

const $ = (id) => document.getElementById(id);
const MIN_SECONDS = 0.4; // shorter presses are treated as accidental taps

const KEY_COMMANDS = {
  r: "read back", q: "repeat question", n: "next question", p: "previous question",
  u: "undo", t: "time left", h: "help",
};
const STATE_LABELS = {
  idle: "Ready", dictate: "Listening · answer", command: "Listening · command",
  processing: "Writing…", speaking: "Speaking",
};

let session = null;
let speaker = null;
let held = null; // "dictate" | "command" while a key or button is held
let busy = false;
let warnedFiveMinutes = false;
let papers = [];
const recorder = new Recorder();

function loadSpeed() {
  try { return parseFloat(localStorage.getItem("likhit-speed")) || 1.0; } catch { return 1.0; }
}
function saveSpeed(v) {
  try { localStorage.setItem("likhit-speed", String(v)); } catch { /* private mode */ }
}

async function api(path, options) {
  const res = await fetch(path, options);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || res.statusText);
  return res.json();
}

// ---------- UI state ----------
function setState(state) {
  document.body.dataset.state = state;
  $("state-label").textContent = STATE_LABELS[state] || state;
}

function settle() {
  if (held) return;
  setState(busy ? "processing" : speaker?.speaking ? "speaking" : "idle");
}

function meterLoop() {
  const level = recorder.level();
  document.querySelector(".orb").style.setProperty("--level", held ? level.toFixed(3) : 0);
  requestAnimationFrame(meterLoop);
}

// ---------- setup ----------
async function loadPapers() {
  papers = await api("/api/papers");
  $("papers").innerHTML = papers.map((p, i) => `
    <label class="paper">
      <input type="radio" name="paper" value="${p.id}" ${i === 0 ? "checked" : ""}>
      <span><span class="title" lang="${p.language.slice(0, 2)}">${p.title}</span>
        <span class="meta">${p.questions} questions · ${p.minutes} minutes</span></span>
      <span class="badge">${p.language}</span>
    </label>`).join("");
}

const selectedPaper = () => papers.find((p) => p.id === document.querySelector("input[name=paper]:checked")?.value);

$("test-mic").addEventListener("click", async () => {
  try {
    if (!recorder.ctx) await recorder.init();
    recorder.ctx.resume();
    $("mic-status").textContent = "Listening… ask the student to say something.";
    $("mic-status").className = "hint";
    let peak = 0;
    const until = performance.now() + 4000;
    const loop = () => {
      const level = recorder.level();
      peak = Math.max(peak, level);
      $("mic-meter").style.width = `${Math.round(level * 100)}%`;
      if (performance.now() < until) return requestAnimationFrame(loop);
      $("mic-meter").style.width = "0";
      const ok = peak > 0.15;
      $("mic-status").textContent = ok ? "Microphone works." : "Very quiet. Move the mic closer and test again.";
      $("mic-status").className = ok ? "hint ok" : "hint";
    };
    loop();
  } catch (e) {
    $("mic-status").textContent = `Microphone blocked: ${e.message}`;
  }
});

$("test-speaker").addEventListener("click", async () => {
  const lang = selectedPaper()?.language || "hi-IN";
  const text = lang.startsWith("hi") ? "नमस्ते। क्या आप मुझे साफ़ सुन पा रहे हैं?" : "Hello. Can you hear me clearly?";
  $("speaker-status").textContent = "Playing…";
  const audio = new Audio(`/api/tts?${new URLSearchParams({ text, lang, speed: loadSpeed().toFixed(2) })}`);
  audio.onended = () => { $("speaker-status").textContent = "Speaker works."; $("speaker-status").className = "hint ok"; };
  audio.onerror = () => { $("speaker-status").textContent = "Could not play audio. Check the API key and volume."; };
  audio.play().catch(() => audio.onerror());
});

$("start").addEventListener("click", async () => {
  $("setup-error").textContent = "";
  try {
    if (!recorder.ctx) await recorder.init(); // needs this click for mic permission and audio autoplay
    const res = await api("/api/session", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paper: selectedPaper().id, student: $("student").value }),
    });
    speaker = new Speaker({ lang: res.state.paper.language, speed: loadSpeed(), onItem: onSpeechItem });
    $("setup").hidden = true;
    $("exam").hidden = false;
    document.documentElement.lang = res.state.paper.language.slice(0, 2);
    handle(res);
    setInterval(tick, 1000);
    meterLoop();
  } catch (e) {
    $("setup-error").textContent = `Could not start: ${e.message}`;
  }
});

// ---------- rendering ----------
function onSpeechItem(item) {
  document.querySelectorAll(".lines li.reading").forEach((li) => li.classList.remove("reading"));
  $("q-text").closest(".card").classList.remove("reading");
  if (item) {
    $("cap-says").textContent = item.text;
    $("live").textContent = item.text;
    if (item.line) $("lines").children[item.line - 1]?.classList.add("reading");
  }
  settle();
}

function render(state) {
  const previous = session;
  session = state;
  if (state.submitted) return showDone(state);
  $("paper-title").textContent = state.paper.title;
  const q = state.question;
  $("q-meta").textContent = `Question ${state.current + 1} of ${state.total}${q.marks ? ` · ${q.marks} marks` : ""}`;
  $("q-text").textContent = q.text;

  // flash lines that are new or changed since the last render of this question
  const before = previous && previous.current === state.current ? previous.lines : null;
  $("lines").innerHTML = "";
  state.lines.forEach((line, i) => {
    const li = document.createElement("li");
    li.textContent = line;
    if (before && before[i] !== line) li.classList.add("changed");
    $("lines").appendChild(li);
  });
  $("empty").hidden = state.lines.length > 0;
  $("line-count").textContent = state.lines.length ? `${state.lines.length} line${state.lines.length > 1 ? "s" : ""}` : "";
  $("lines").lastElementChild?.classList.contains("changed") && $("lines").lastElementChild.scrollIntoView({ block: "nearest", behavior: "smooth" });

  $("progress").innerHTML = state.answered.map((done, i) =>
    `<span class="${i === state.current ? "cur" : ""} ${done ? "done" : ""}" aria-label="question ${i + 1}${done ? ", answered" : ""}">${i + 1}</span>`).join("");
  renderTimer();
}

function renderTimer() {
  if (!session) return;
  const s = Math.max(0, session.seconds_left);
  $("timer").textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  $("timer").classList.toggle("low", s <= 300 && s > 60);
  $("timer").classList.toggle("critical", s <= 60);
}

function showDone(state) {
  speaker?.stop();
  const answered = state.answered.filter(Boolean).length;
  $("done-summary").textContent = `${state.student ? state.student + " · " : ""}${answered} of ${state.total} questions answered.`;
  $("sheet-link").href = `/export/${state.id}`;
  $("done-hash").textContent = state.log_hash;
  $("exam").hidden = true;
  $("done").hidden = false;
}

function handle(res) {
  if (res.transcript !== undefined) $("cap-heard").textContent = res.transcript || "—";
  const wasSubmitted = session?.submitted;
  render(res.state);
  if (res.state.submitted && !wasSubmitted) {
    // let the closing line play over the done screen
    new Audio(speaker.url(res.speech.map((s) => s.text).join(" "))).play().catch(() => {});
    return;
  }
  if (res.speech?.length) speaker.say(res.speech);
}

async function tick() {
  if (!session || session.submitted) return;
  session.seconds_left -= 1;
  renderTimer();
  if (session.seconds_left === 300 && !warnedFiveMinutes) {
    warnedFiveMinutes = true;
    sendText("time left");
  }
  if (session.seconds_left <= 0) handle(await api(`/api/session/${session.id}`));
}

// ---------- actions ----------
async function sendText(text) {
  if (busy || session?.submitted) return;
  busy = true; settle();
  try {
    const form = new FormData();
    form.append("text", text);
    handle(await api(`/api/session/${session.id}/command`, { method: "POST", body: form }));
  } catch (e) {
    earcon("error"); $("cap-says").textContent = `Error: ${e.message}`;
  } finally { busy = false; settle(); }
}

function startRecording(kind) {
  if (busy || held || session?.submitted) return;
  speaker.stop(); // barge-in: the student never has to wait for Likhit to finish talking
  held = kind;
  recorder.start();
  earcon("start");
  setState(kind);
  $(kind === "dictate" ? "hold-answer" : "hold-command").setAttribute("aria-pressed", "true");
}

async function stopRecording() {
  const kind = held;
  if (!kind) return;
  held = null;
  $("hold-answer").setAttribute("aria-pressed", "false");
  $("hold-command").setAttribute("aria-pressed", "false");
  const { chunks, seconds } = recorder.stop();
  earcon("stop");
  if (seconds < MIN_SECONDS) { settle(); return; }
  busy = true; settle();
  try {
    if (kind === "command") {
      const form = new FormData();
      form.append("audio", chunks[0], "command.wav");
      handle(await api(`/api/session/${session.id}/command`, { method: "POST", body: form }));
    } else {
      // long answers arrive as several ≤25 s chunks; send in order so context carries over
      let res;
      for (const chunk of chunks) {
        const form = new FormData();
        form.append("audio", chunk, "answer.wav");
        res = await api(`/api/session/${session.id}/dictate`, { method: "POST", body: form });
        render(res.state);
      }
      handle(res);
    }
  } catch (e) {
    earcon("error"); $("cap-says").textContent = `Error: ${e.message}`;
  } finally { busy = false; settle(); }
}

function changeSpeed(delta) {
  speaker.speed = Math.round(Math.min(1.15, Math.max(0.85, speaker.speed + delta)) * 100) / 100;
  saveSpeed(speaker.speed);
  earcon("done");
  $("cap-says").textContent = `Speed ${speaker.speed}×`;
}

// keyboard: hold Space / C to talk, single keys for everything else
document.addEventListener("keydown", (e) => {
  if (!session || $("exam").hidden || e.ctrlKey || e.metaKey || e.altKey) return;
  const key = e.key.toLowerCase();
  if (e.repeat) { if (key === " " || key === "c") e.preventDefault(); return; }
  if (key === " ") { e.preventDefault(); startRecording("dictate"); }
  else if (key === "c") { e.preventDefault(); startRecording("command"); }
  else if (key === "escape") speaker.stop();
  else if (key === "+" || key === "=") changeSpeed(0.05);
  else if (key === "-" || key === "_") changeSpeed(-0.05);
  else if (KEY_COMMANDS[key] && !held) { e.preventDefault(); speaker.stop(); sendText(KEY_COMMANDS[key]); }
});
document.addEventListener("keyup", (e) => {
  const key = e.key.toLowerCase();
  if ((key === " " && held === "dictate") || (key === "c" && held === "command")) {
    e.preventDefault();
    stopRecording();
  }
});

// pointer: the same hold-to-talk on the on-screen buttons (mouse, touch, switch access)
for (const [id, kind] of [["hold-answer", "dictate"], ["hold-command", "command"]]) {
  const btn = $(id);
  btn.addEventListener("pointerdown", (e) => { e.preventDefault(); btn.setPointerCapture(e.pointerId); startRecording(kind); });
  for (const ev of ["pointerup", "pointercancel"]) btn.addEventListener(ev, () => { if (held === kind) stopRecording(); });
  btn.addEventListener("keydown", (e) => { if (e.key === "Enter") e.preventDefault(); });
  btn.addEventListener("contextmenu", (e) => e.preventDefault());
}

loadPapers().catch((e) => { $("setup-error").textContent = `Could not load papers: ${e.message}`; });
