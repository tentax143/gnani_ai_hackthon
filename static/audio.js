// Microphone capture to 16 kHz mono WAV (Prisma does not accept Chrome's webm),
// earcons, and a speech queue with barge-in.

const TARGET_RATE = 16000;
const MAX_CHUNK_SECONDS = 25; // Prisma REST accepts up to 30 s per request

export class Recorder {
  async init() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    this.ctx = new AudioContext();
    await this.ctx.audioWorklet.addModule("/static/recorder-worklet.js");
    const source = this.ctx.createMediaStreamSource(this.stream);
    this.node = new AudioWorkletNode(this.ctx, "recorder");
    this.node.port.onmessage = (e) => { if (this.recording) this.buffers.push(e.data); };
    source.connect(this.node);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.levelData = new Float32Array(this.analyser.fftSize);
    source.connect(this.analyser);
  }

  /** Mic loudness, 0..1, for the on-screen meter. */
  level() {
    if (!this.analyser) return 0;
    this.analyser.getFloatTimeDomainData(this.levelData);
    let sum = 0;
    for (const v of this.levelData) sum += v * v;
    return Math.min(1, Math.sqrt(sum / this.levelData.length) * 6);
  }

  start() {
    this.ctx.resume();
    this.buffers = [];
    this.recording = true;
  }

  /** Stops and returns a list of WAV blobs, each at most MAX_CHUNK_SECONDS long. */
  stop() {
    this.recording = false;
    const samples = downsample(concat(this.buffers), this.ctx.sampleRate, TARGET_RATE);
    const seconds = samples.length / TARGET_RATE;
    const step = MAX_CHUNK_SECONDS * TARGET_RATE;
    const chunks = [];
    for (let i = 0; i < samples.length; i += step) chunks.push(encodeWav(samples.subarray(i, i + step)));
    return { chunks, seconds };
  }
}

function concat(buffers) {
  const out = new Float32Array(buffers.reduce((n, b) => n + b.length, 0));
  let offset = 0;
  for (const b of buffers) { out.set(b, offset); offset += b.length; }
  return out;
}

function downsample(input, from, to) {
  if (from === to) return input;
  const ratio = from / to;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    // average the input samples that fall into this output sample (cheap low-pass)
    const start = Math.floor(i * ratio), end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j];
    out[i] = sum / Math.max(1, end - start);
  }
  return out;
}

function encodeWav(samples) {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, "RIFF"); v.setUint32(4, 36 + samples.length * 2, true); str(8, "WAVE");
  str(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, TARGET_RATE, true); v.setUint32(28, TARGET_RATE * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, "data"); v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buf], { type: "audio/wav" });
}

const earconCtx = new AudioContext();

/** Short tones so a blind user knows the mic opened, closed, or something failed. */
export function earcon(kind) {
  const tones = { start: [880], stop: [660], error: [220, 180], done: [660, 880] };
  let t = earconCtx.currentTime;
  for (const freq of tones[kind] || []) {
    const osc = earconCtx.createOscillator(), gain = earconCtx.createGain();
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(gain).connect(earconCtx.destination);
    osc.start(t); osc.stop(t + 0.12);
    t += 0.14;
  }
  earconCtx.resume();
}

/**
 * Plays Timbre speech one utterance at a time; stop() cuts it off (barge-in).
 * Items are {text, line}; onItem fires as each starts (null when done) so the
 * UI can caption it and highlight the answer line being read.
 */
export class Speaker {
  constructor({ lang, speed, onItem }) {
    this.lang = lang;
    this.speed = speed;
    this.onItem = onItem;
    this.queue = [];
    this.current = null;
    this.generation = 0;
  }

  url(text) {
    const q = new URLSearchParams({ text, lang: this.lang, speed: this.speed.toFixed(2) });
    return `/api/tts?${q}`;
  }

  say(items) {
    this.stop();
    const gen = this.generation;
    // create all elements up front so later utterances download while earlier ones play
    this.queue = items.map((item) => {
      const it = typeof item === "string" ? { text: item, line: null } : item;
      return { ...it, audio: new Audio(this.url(it.text)) };
    });
    this.next(gen);
  }

  next(gen) {
    if (gen !== this.generation) return;
    const item = this.queue.shift();
    if (!item) { this.current = null; this.onItem?.(null); return; }
    this.current = item.audio;
    this.onItem?.(item);
    item.audio.onended = () => this.next(gen);
    item.audio.onerror = () => { earcon("error"); this.next(gen); };
    item.audio.play().catch(() => this.next(gen));
  }

  get speaking() { return this.current !== null; }

  stop() {
    this.generation++;
    if (this.current) { this.current.pause(); this.current = null; this.onItem?.(null); }
    for (const item of this.queue) item.audio.src = "";
    this.queue = [];
  }
}
