import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { AT, SCENES, rel } from "./timeline";
import {
  AnswerLines,
  C,
  Card,
  Chip,
  Key,
  Logo,
  Orb,
  Rise,
  Scene,
  Wave,
  useProgress,
  useSpring,
} from "./ui";

const len = (id: keyof typeof SCENES) => SCENES[id][1] - SCENES[id][0];
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** 1 while the given clip is playing (with soft edges), else 0. Time is scene-relative. */
const useActive = (start: number, end: number) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = frame / fps;
  return interpolate(s, [start - 0.15, start + 0.1, end - 0.1, end + 0.15], [0, 1, 1, 0], clamp);
};

const useSeconds = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return frame / fps;
};

const H1: React.FC<{ children: React.ReactNode; size?: number; style?: React.CSSProperties }> = ({
  children,
  size = 104,
  style,
}) => (
  <h1 style={{ margin: 0, fontSize: size, lineHeight: 1.08, fontWeight: 800, letterSpacing: -1.5, ...style }}>
    {children}
  </h1>
);

const Eyebrow: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color = C.accent }) => (
  <p style={{ margin: "0 0 22px", fontSize: 34, fontWeight: 700, color, letterSpacing: 3, textTransform: "uppercase" }}>
    {children}
  </p>
);

// ---------------------------------------------------------------- 1. hook
export const Hook: React.FC = () => (
  <Scene dur={len("hook")}>
    <Rise at={0.2}>
      <Eyebrow>Board exams · India</Eyebrow>
    </Rise>
    <Rise at={0.5}>
      <H1>A blind student</H1>
    </Rise>
    <Rise at={1.3}>
      <H1>writes their exam</H1>
    </Rise>
    <Rise at={2.2}>
      <H1>
        through <span style={{ color: C.listen }}>someone else’s hand.</span>
      </H1>
    </Rise>
  </Scene>
);

// ---------------------------------------------------------------- 2. problem
export const Problem: React.FC = () => {
  const swap = useProgress(1.6, 0.5);
  const q = useSpring(2.6, 11);
  return (
    <Scene dur={len("problem")} style={{ flexDirection: "row", alignItems: "center", gap: 110 }}>
      <Rise at={0.1} style={{ flex: "0 0 820px" }}>
        <div
          style={{
            background: C.paper,
            color: C.ink,
            borderRadius: 18,
            padding: "50px 56px",
            rotate: "-2deg",
            boxShadow: "0 40px 90px rgba(0,0,0,0.5)",
            fontSize: 46,
            lineHeight: 1.7,
            backgroundImage: `repeating-linear-gradient(transparent 0 76px, #d8d0bf 76px 78px)`,
          }}
        >
          <div style={{ fontSize: 30, color: "#7a7468", fontWeight: 600 }}>Answer 1 · written by scribe</div>
          <div>Plants make food from sunlight.</div>
          <div>
            They need chlorophyll and{" "}
            {swap < 0.5 ? (
              <span style={{ opacity: 1 - swap * 2 }}>water</span>
            ) : (
              <span style={{ opacity: swap * 2 - 1, color: "#b0261f", fontStyle: "italic" }}>salt</span>
            )}
            .
          </div>
        </div>
      </Rise>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 220, fontWeight: 800, color: C.listen, lineHeight: 1, scale: String(q) }}>?</div>
        <Rise at={2.9}>
          <H1 size={84}>No way to check what was written.</H1>
        </Rise>
      </div>
    </Scene>
  );
};

// ---------------------------------------------------------------- 3. intro
export const Intro: React.FC = () => {
  const pop = useSpring(0.3, 12);
  return (
    <Scene dur={len("intro")} style={{ alignItems: "center", textAlign: "center" }}>
      <div style={{ scale: String(pop), marginBottom: 46 }}>
        <Logo size={190} />
      </div>
      <Rise at={0.6}>
        <H1 size={150}>
          Likhit <span style={{ color: C.accent, fontWeight: 700 }}>लिखित</span>
        </H1>
      </Rise>
      <Rise at={1.4}>
        <p style={{ fontSize: 50, color: C.muted, margin: "22px 0 40px" }}>
          A voice exam scribe for visually impaired students
        </p>
      </Rise>
      <Rise at={2.4}>
        <Chip>Built on Gnani AI</Chip>
      </Rise>
    </Scene>
  );
};

// ---------------------------------------------------------------- 4. question
const QUESTION = ["प्रकाश", "संश्लेषण", "क्या", "है?", "इसके", "लिए", "आवश्यक", "दो", "चीज़ें", "लिखिए।"];

export const Question: React.FC = () => {
  const l1s = rel("question", AT.l1.start);
  const l1e = rel("question", AT.l1.end);
  const speaking = useActive(l1s, l1e);
  const s = useSeconds();
  // Rough karaoke: "प्रश्न एक" takes ~1 s, then words share the rest.
  const wordAt = (i: number) => l1s + 1.0 + ((l1e - l1s - 1.4) * i) / QUESTION.length;
  return (
    <Scene dur={len("question")} style={{ flexDirection: "row", alignItems: "center", gap: 90 }}>
      <div style={{ flex: "0 0 420px", display: "flex", flexDirection: "column", alignItems: "center", gap: 30 }}>
        <Orb color={C.accent} active={Math.max(0.15, speaking)} size={300} />
        <Rise at={0.3}>
          <Chip>Speaks · Timbre v3.0</Chip>
        </Rise>
      </div>
      <div style={{ flex: 1 }}>
        <Rise at={0.1}>
          <Eyebrow>Reads every question aloud</Eyebrow>
        </Rise>
        <Rise at={0.5}>
          <Card style={{ padding: "44px 52px" }}>
            <div style={{ fontSize: 32, color: C.muted, fontWeight: 600, marginBottom: 14 }}>
              Question 1 of 4 · 2 marks
            </div>
            <div style={{ fontSize: 66, lineHeight: 1.45, fontWeight: 600 }}>
              {QUESTION.map((w, i) => {
                const lit = s >= wordAt(i);
                return (
                  <span key={i} style={{ color: lit ? C.fg : "#5a5866" }}>
                    {w}{" "}
                  </span>
                );
              })}
            </div>
          </Card>
        </Rise>
        <Rise at={1.4} style={{ display: "flex", gap: 18, marginTop: 34 }}>
          <Chip color={C.fg} bg={C.surface2}>
            हिंदी
          </Chip>
          <Chip color={C.fg} bg={C.surface2}>
            English
          </Chip>
          <Chip color={C.muted} bg="transparent">
            speed 0.85× – 1.15×
          </Chip>
        </Rise>
      </div>
    </Scene>
  );
};

// ---------------------------------------------------------------- 5. dictate
export const LINE1 = "हरे पौधे सूर्य के प्रकाश से भोजन बनाते हैं।";
export const Line2: React.FC<{ swap?: number; flash?: number }> = ({ swap = 0, flash = 0 }) => (
  <>
    इसके लिए क्लोरोफिल और{" "}
    {swap < 1 && (
      <span
        style={{
          color: swap > 0 ? C.danger : undefined,
          textDecoration: swap > 0 ? "line-through" : undefined,
          textDecorationThickness: 4,
          opacity: 1 - Math.max(0, swap - 0.5) * 2,
        }}
      >
        पानी
      </span>
    )}
    {swap > 0 && (
      <span
        style={{
          color: C.ok,
          fontWeight: 700,
          marginLeft: swap < 1 ? 14 : 0,
          background: `rgba(95,211,141,${0.25 * flash})`,
          borderRadius: 10,
          padding: "0 6px",
          opacity: Math.min(1, swap * 2),
        }}
      >
        कार्बन डाइऑक्साइड
      </span>
    )}{" "}
    आवश्यक हैं।
  </>
);

export const Dictate: React.FC = () => {
  const s1s = rel("dictate", AT.s1.start);
  const s1e = rel("dictate", AT.s1.end);
  const listening = useActive(s1s - 0.3, s1e + 0.1);
  const written = s1e + 0.35;
  const s = useSeconds();
  return (
    <Scene dur={len("dictate")} style={{ flexDirection: "row", alignItems: "center", gap: 90 }}>
      <div style={{ flex: 1 }}>
        <Rise at={0.1}>
          <Eyebrow color={C.listen}>Answers by speaking</Eyebrow>
        </Rise>
        <Rise at={0.4}>
          <Card style={{ minHeight: 330 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 32, color: C.muted, marginBottom: 12 }}>
              <b style={{ color: C.fg }}>Answer</b>
              <span>{s > written ? "2 lines" : ""}</span>
            </div>
            {s < written ? (
              <div style={{ fontSize: 40, color: C.muted, padding: "50px 0" }}>
                {listening > 0.5 ? "Listening…" : "Hold Space and speak to start writing."}
              </div>
            ) : (
              <AnswerLines lines={[LINE1, <Line2 key="l2" />]} appear={[written, written + 0.25]} />
            )}
          </Card>
        </Rise>
        <Rise at={1.2} style={{ display: "flex", gap: 18, marginTop: 34 }}>
          <Chip color={C.fg} bg={C.surface2}>हिंदी</Chip>
          <Chip color={C.fg} bg={C.surface2}>English</Chip>
          <Chip color={C.fg} bg={C.surface2}>Hinglish</Chip>
          <Chip color={C.listen} bg={C.listenSoft}>Prisma v3.0</Chip>
        </Rise>
      </div>
      <div style={{ flex: "0 0 420px", display: "flex", flexDirection: "column", alignItems: "center", gap: 40 }}>
        <Orb color={C.listen} active={Math.max(0.12, listening)} size={280} />
        <Wave color={C.listen} active={listening} bars={22} />
        <Rise at={0.8}>
          <Key label="Space" width={300} pressed={listening} color={C.listen} />
        </Rise>
      </div>
    </Scene>
  );
};

// ---------------------------------------------------------------- 6. edit
export const Edit: React.FC = () => {
  const s2s = rel("edit", AT.s2.start);
  const s2e = rel("edit", AT.s2.end);
  const l2s = rel("edit", AT.l2.start);
  const l2e = rel("edit", AT.l2.end);
  const talking = useActive(s2s - 0.3, s2e + 0.1);
  const typed = useProgress(s2s, s2e - s2s);
  const swap = useProgress(l2s - 0.1, 0.9);
  const flash = interpolate(useSeconds(), [l2s + 0.4, l2s + 0.8, l2e], [0, 1, 0.25], clamp);
  const likhit = useActive(l2s, l2e);
  const cmd = "दूसरी लाइन में पानी को कार्बन डाइऑक्साइड करो";
  const shown = Array.from(cmd).slice(0, Math.round(Array.from(cmd).length * typed)).join("");
  return (
    <Scene dur={len("edit")}>
      <Rise at={0.1}>
        <Eyebrow color={C.command}>Edits by voice</Eyebrow>
      </Rise>
      <div style={{ display: "flex", gap: 60, alignItems: "stretch" }}>
        <Card style={{ flex: 1 }}>
          <div style={{ fontSize: 32, color: C.muted, marginBottom: 12, fontWeight: 600 }}>Answer</div>
          <AnswerLines lines={[LINE1, <Line2 key="l2" swap={swap} flash={flash} />]} highlight={swap > 0 ? 1 : -1} />
        </Card>
        <div style={{ flex: "0 0 300px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 30 }}>
          <Orb color={likhit > 0.1 ? C.accent : C.command} active={Math.max(0.12, talking, likhit)} size={220} />
          <Key label="C" pressed={talking} color={C.command} />
        </div>
      </div>
      <div style={{ marginTop: 40, minHeight: 110, display: "flex", gap: 30 }}>
        {typed > 0 && (
          <div
            style={{
              background: C.commandSoft,
              border: `2px solid ${C.command}`,
              color: C.fg,
              borderRadius: 24,
              padding: "18px 34px",
              fontSize: 44,
              fontWeight: 600,
            }}
          >
            <span style={{ color: C.command, marginRight: 18 }}>Command</span>“{shown}”
          </div>
        )}
        {swap > 0.3 && (
          <Chip color={C.ok} bg={C.okSoft} style={{ alignSelf: "center", fontSize: 40 }}>
            ✓ बदल दिया
          </Chip>
        )}
      </div>
    </Scene>
  );
};

// ---------------------------------------------------------------- 7. read back
export const Readback: React.FC = () => {
  const s = useSeconds();
  const hl = s < 0.4 ? -1 : s < 2.4 ? 0 : s < 4.2 ? 1 : -1;
  const reading = useActive(0.3, 4.3);
  return (
    <Scene dur={len("readback")} style={{ flexDirection: "row", alignItems: "center", gap: 70 }}>
      <div style={{ flex: 1 }}>
        <Rise at={0.1}>
          <Eyebrow>Reads it back, line by line</Eyebrow>
        </Rise>
        <Card>
          <AnswerLines lines={[LINE1, <Line2 key="l2" swap={1} />]} highlight={hl} />
        </Card>
        <div style={{ display: "flex", gap: 20, marginTop: 36, alignItems: "center" }}>
          <Orb color={C.accent} active={Math.max(0.12, reading)} size={110} />
          <span style={{ fontSize: 38, color: C.muted }}>“लाइन {hl === 1 ? "दो" : "एक"}: …”</span>
        </div>
      </div>
      <div style={{ flex: "0 0 520px", display: "flex", flexDirection: "column", gap: 20 }}>
        <Rise at={2.6}>
          <H1 size={88} style={{ color: C.muted, textDecoration: "line-through", textDecorationColor: C.listen }}>
            No screen.
          </H1>
        </Rise>
        <Rise at={3.3}>
          <H1 size={88} style={{ color: C.muted, textDecoration: "line-through", textDecorationColor: C.listen }}>
            No mouse.
          </H1>
        </Rise>
        <Rise at={4.2}>
          <H1 size={88}>Keyboard + voice.</H1>
        </Rise>
        <Rise at={4.6} style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          {["Space", "C", "R", "Q", "N", "U"].map((k) => (
            <Key key={k} label={k} />
          ))}
        </Rise>
      </div>
    </Scene>
  );
};

// ---------------------------------------------------------------- 8. audit
const BLOCKS = [
  { what: "dictate", hash: "9f2c…a1" },
  { what: "replace", hash: "41be…7d" },
  { what: "read", hash: "c07a…e3" },
  { what: "submit", hash: "5d19…08" },
];

export const Audit: React.FC = () => {
  const stamp = useSpring(2.9, 10);
  return (
    <Scene dur={len("audit")} style={{ alignItems: "center", textAlign: "center" }}>
      <Rise at={0.1}>
        <Eyebrow color={C.ok}>Tamper-evident</Eyebrow>
      </Rise>
      <Rise at={0.3}>
        <H1 size={92}>Every edit, hash-chained.</H1>
      </Rise>
      <div style={{ display: "flex", alignItems: "center", gap: 0, marginTop: 70 }}>
        {BLOCKS.map((b, i) => (
          <React.Fragment key={b.what}>
            {i > 0 && (
              <Rise at={0.7 + i * 0.4} dy={0} style={{ width: 70, height: 6, background: C.ok, borderRadius: 3 }}>
                {null}
              </Rise>
            )}
            <Rise at={0.6 + i * 0.4}>
              <div
                style={{
                  width: 300,
                  padding: "26px 0",
                  borderRadius: 24,
                  background: C.surface,
                  border: `2px solid ${C.line}`,
                }}
              >
                <div style={{ fontSize: 42, fontWeight: 700 }}>{b.what}</div>
                <div style={{ fontSize: 30, color: C.muted, fontFamily: "monospace" }}>sha256 {b.hash}</div>
              </div>
            </Rise>
          </React.Fragment>
        ))}
      </div>
      <div style={{ marginTop: 60, scale: String(stamp), opacity: stamp }}>
        <Chip color={C.ok} bg={C.okSoft} style={{ fontSize: 46, padding: "16px 40px" }}>
          ✓ Log verified by the invigilator
        </Chip>
      </div>
    </Scene>
  );
};

// ---------------------------------------------------------------- 9. outro
export const Outro: React.FC = () => {
  const pop = useSpring(0.1, 12);
  return (
    <Scene dur={len("outro")} style={{ alignItems: "center", textAlign: "center", paddingBottom: 110 }}>
      <div style={{ scale: String(pop), marginBottom: 40 }}>
        <Logo size={150} />
      </div>
      <Rise at={0.3}>
        <H1 size={140}>Likhit</H1>
      </Rise>
      <Rise at={1.0}>
        <p style={{ fontSize: 60, margin: "20px 0 60px", fontWeight: 600 }}>
          Your words, <span style={{ color: C.accent }}>exactly as you said them.</span>
        </p>
      </Rise>
      <Rise at={2.0} style={{ display: "flex", gap: 18, justifyContent: "center" }}>
        <Chip color={C.listen} bg={C.listenSoft}>Gnani Prisma v3.0</Chip>
        <Chip>Gnani Timbre v3.0</Chip>
      </Rise>
      <Rise at={2.6}>
        <p style={{ fontSize: 30, color: C.muted, marginTop: 34 }}>
          Every voice in this video is Gnani Timbre · Synthetic exam paper · Great Indian AI Internship Challenge
        </p>
      </Rise>
    </Scene>
  );
};
