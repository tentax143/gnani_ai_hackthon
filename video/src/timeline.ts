// Voiceover timing, derived from the Timbre clip lengths in vo.json (seconds).
// Re-run scripts/voiceover.py and the whole video re-times itself.
import vo from "./vo.json";

export type ClipId = keyof typeof vo;

// [clip, pause before it in seconds]
const ORDER: [ClipId, number][] = [
  ["n1", 0.5],
  ["n2", 0.3],
  ["n3", 0.5],
  ["n4", 0.5],
  ["l1", 0.25],
  ["n5", 0.5],
  ["s1", 0.25],
  ["n6", 1.4], // room for "release Space → lines appear"
  ["s2", 0.2],
  ["l2", 0.35],
  ["n7", 0.5],
  ["n8", 0.45],
  ["n9", 0.5],
];

export const AT = {} as Record<ClipId, { start: number; end: number }>;
let t = 0;
for (const [id, pause] of ORDER) {
  t += pause;
  AT[id] = { start: t, end: t + vo[id] };
  t += vo[id];
}

export const END = t + 2.2;

// Scene boundaries (seconds). Each scene starts slightly before its first clip.
const lead = 0.25;
export const SCENES = {
  hook: [0, AT.n2.start - lead],
  problem: [AT.n2.start - lead, AT.n3.start - lead],
  intro: [AT.n3.start - lead, AT.n4.start - lead],
  question: [AT.n4.start - lead, AT.n5.start - lead],
  dictate: [AT.n5.start - lead, AT.n6.start - 0.1],
  edit: [AT.n6.start - 0.1, AT.n7.start - lead],
  readback: [AT.n7.start - lead, AT.n8.start - lead],
  audit: [AT.n8.start - lead, AT.n9.start - lead],
  outro: [AT.n9.start - lead, END],
} as const;

export type SceneId = keyof typeof SCENES;

/** Seconds relative to a scene's start, for use inside that scene. */
export const rel = (scene: SceneId, abs: number) => abs - SCENES[scene][0];

export const CAPTIONS: Record<ClipId, { who: "narrator" | "likhit" | "student"; text: string; en?: string }> = {
  n1: { who: "narrator", text: "In India, a blind student often writes their board exam through someone else's hand." },
  n2: { who: "narrator", text: "If the scribe mishears, or changes a word, the student can never check what was written." },
  n3: { who: "narrator", text: "Meet Likhit. A voice exam scribe, built on Gnani AI." },
  n4: { who: "narrator", text: "Likhit reads every question aloud, in the student's own language." },
  l1: { who: "likhit", text: "प्रश्न एक। प्रकाश संश्लेषण क्या है?", en: "Question 1. What is photosynthesis? Name two things it needs." },
  n5: { who: "narrator", text: "The student just speaks. Hindi, English, or Hinglish. Gnani Prisma writes it down." },
  s1: { who: "student", text: "हरे पौधे सूर्य के प्रकाश से भोजन बनाते हैं…", en: "Green plants make food from sunlight. This needs chlorophyll and water." },
  n6: { who: "narrator", text: "Mistakes? Fix them by voice." },
  s2: { who: "student", text: "दूसरी लाइन में पानी को कार्बन डाइऑक्साइड करो।", en: "“In line two, change water to carbon dioxide.”" },
  l2: { who: "likhit", text: "बदल दिया। लाइन दो अब है…", en: "Done. Line two now reads: …chlorophyll and carbon dioxide are needed." },
  n7: { who: "narrator", text: "Likhit reads the answer back, line by line. No screen. No mouse. Just a keyboard and a voice." },
  n8: { who: "narrator", text: "Every edit is sealed in a hash-chained log that the invigilator can verify." },
  n9: { who: "narrator", text: "Likhit. Your words, exactly as you said them." },
};
