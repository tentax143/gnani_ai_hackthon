// Shared look (taken from the Likhit app's dark theme) and small animated primitives.
import { loadFont } from "@remotion/google-fonts/Mukta";
import React from "react";
import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const { fontFamily } = loadFont("normal", {
  weights: ["400", "600", "700", "800"],
  subsets: ["devanagari", "latin"],
});

export const C = {
  bg: "#0d0e13",
  surface: "#191a22",
  surface2: "#22232d",
  line: "#2e2f3b",
  fg: "#f3f2f7",
  muted: "#a9a7b3",
  accent: "#8f8bff",
  accentDeep: "#3a35c9",
  accentSoft: "#26244a",
  listen: "#ff6b9a",
  listenSoft: "#3a1626",
  command: "#ffad4d",
  commandSoft: "#3a2810",
  ok: "#5fd38d",
  okSoft: "#15301f",
  danger: "#ff6b6b",
  paper: "#f6f3ec",
  ink: "#16151a",
};

const ease = Easing.bezier(0.16, 1, 0.3, 1);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** 0→1 over `dur` seconds starting at `at` seconds. */
export const useProgress = (at: number, dur = 0.6) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return interpolate(frame, [at * fps, (at + dur) * fps], [0, 1], { ...clamp, easing: ease });
};

export const useSpring = (at: number, damping = 14) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - at * fps, fps, config: { damping } });
};

/** Fades and lifts its children in at `at` seconds. */
export const Rise: React.FC<{ at: number; dy?: number; style?: React.CSSProperties; children: React.ReactNode }> = ({
  at,
  dy = 30,
  style,
  children,
}) => {
  const p = useProgress(at, 0.7);
  return <div style={{ opacity: p, translate: `0px ${(1 - p) * dy}px`, ...style }}>{children}</div>;
};

/** Scene wrapper: background, safe-area padding, fade in/out at the edges. */
export const Scene: React.FC<{ dur: number; children: React.ReactNode; style?: React.CSSProperties }> = ({
  dur,
  children,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = interpolate(frame, [0, 0.25 * fps, (dur - 0.25) * fps, dur * fps], [0, 1, 1, 0], clamp);
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        padding: "110px 150px 200px",
        fontFamily,
        color: C.fg,
        opacity,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** Moving background glow shared by the whole video. */
export const Backdrop: React.FC = () => {
  const frame = useCurrentFrame();
  const x = 30 + Math.sin(frame / 90) * 12;
  const y = 35 + Math.cos(frame / 110) * 10;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: `radial-gradient(900px 700px at ${x}% ${y}%, rgba(143,139,255,0.16), transparent 70%),
                     radial-gradient(800px 600px at ${100 - x}% ${100 - y}%, rgba(255,107,154,0.08), transparent 70%), ${C.bg}`,
      }}
    />
  );
};

export const Logo: React.FC<{ size: number }> = ({ size }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size * 0.26,
      background: `linear-gradient(135deg, ${C.accent}, ${C.accentDeep})`,
      color: "white",
      fontWeight: 700,
      fontSize: size * 0.5,
      display: "grid",
      placeItems: "center",
      boxShadow: `0 ${size * 0.15}px ${size * 0.5}px rgba(58,53,201,0.45)`,
      paddingTop: size * 0.04,
    }}
  >
    लि
  </div>
);

export const Chip: React.FC<{ color?: string; bg?: string; children: React.ReactNode; style?: React.CSSProperties }> = ({
  color = C.accent,
  bg = C.accentSoft,
  children,
  style,
}) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 12,
      padding: "10px 26px",
      borderRadius: 999,
      background: bg,
      color,
      fontWeight: 600,
      fontSize: 34,
      border: `1px solid ${color}44`,
      ...style,
    }}
  >
    {children}
  </span>
);

export const Key: React.FC<{ label: string; pressed?: number; color?: string; width?: number }> = ({
  label,
  pressed = 0,
  color = C.accent,
  width = 96,
}) => (
  <div
    style={{
      minWidth: width,
      height: 96,
      padding: "0 26px",
      borderRadius: 18,
      display: "grid",
      placeItems: "center",
      fontSize: 38,
      fontWeight: 700,
      background: pressed > 0.5 ? color : C.surface2,
      color: pressed > 0.5 ? C.bg : C.fg,
      border: `2px solid ${pressed > 0.5 ? color : C.line}`,
      borderBottomWidth: 8 - pressed * 5,
      translate: `0px ${pressed * 5}px`,
      boxShadow: pressed > 0.5 ? `0 0 40px ${color}88` : "none",
    }}
  >
    {label}
  </div>
);

/** Speaking / listening orb with a fake level driven by `active` (0..1). */
export const Orb: React.FC<{ color: string; active: number; size?: number }> = ({ color, active, size = 220 }) => {
  const frame = useCurrentFrame();
  const level = active * (0.55 + 0.45 * Math.abs(Math.sin(frame / 3.1) * Math.cos(frame / 5.3)));
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      {[0, 1, 2].map((i) => {
        const phase = ((frame / 40 + i / 3) % 1) * active;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              border: `3px solid ${color}`,
              opacity: (1 - phase) * active * 0.6,
              scale: String(1 + phase * 0.7),
            }}
          />
        );
      })}
      <div
        style={{
          position: "absolute",
          inset: size * 0.18,
          borderRadius: "50%",
          background: `radial-gradient(circle at 35% 30%, white, ${color} 45%, ${color}aa)`,
          scale: String(1 + level * 0.18),
          boxShadow: `0 0 ${60 + level * 80}px ${color}aa`,
        }}
      />
    </div>
  );
};

/** Waveform bars; `active` 0..1. */
export const Wave: React.FC<{ color: string; active: number; bars?: number; height?: number }> = ({
  color,
  active,
  bars = 28,
  height = 90,
}) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, height }}>
      {Array.from({ length: bars }, (_, i) => {
        const v = Math.abs(Math.sin(frame / 2.7 + i * 1.7) * Math.sin(frame / 6.1 + i * 0.6));
        return (
          <div
            key={i}
            style={{ width: 9, borderRadius: 9, background: color, height: 10 + v * (height - 10) * active }}
          />
        );
      })}
    </div>
  );
};

export const Card: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div
    style={{
      background: C.surface,
      border: `1px solid ${C.line}`,
      borderRadius: 28,
      padding: "34px 42px",
      boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
      ...style,
    }}
  >
    {children}
  </div>
);

/** Numbered answer lines as in the app. `highlight` index gets the reading style. */
export const AnswerLines: React.FC<{ lines: React.ReactNode[]; highlight?: number; appear?: number[] }> = ({
  lines,
  highlight = -1,
  appear,
}) => (
  <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 14 }}>
    {lines.map((l, i) => (
      <AnswerLine key={i} n={i + 1} reading={i === highlight} at={appear?.[i]}>
        {l}
      </AnswerLine>
    ))}
  </ol>
);

const AnswerLine: React.FC<{ n: number; reading: boolean; at?: number; children: React.ReactNode }> = ({
  n,
  reading,
  at,
  children,
}) => {
  const p = useProgress(at ?? -10, 0.5);
  return (
    <li
      style={{
        display: "flex",
        gap: 22,
        alignItems: "baseline",
        fontSize: 42,
        lineHeight: 1.45,
        padding: "10px 18px",
        borderRadius: 16,
        background: reading ? C.accentSoft : "transparent",
        outline: reading ? `2px solid ${C.accent}` : "2px solid transparent",
        opacity: p,
        translate: `${(1 - p) * -24}px 0px`,
      }}
    >
      <span style={{ color: reading ? C.accent : C.muted, fontWeight: 700, minWidth: 30 }}>{n}</span>
      <span>{children}</span>
    </li>
  );
};
