import { Audio } from "@remotion/media";
import React from "react";
import { AbsoluteFill, Sequence, Track, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Audit, Dictate, Edit, Hook, Intro, Outro, Problem, Question, Readback } from "./scenes";
import { AT, CAPTIONS, type ClipId, SCENES, type SceneId } from "./timeline";
import { Backdrop, C, fontFamily } from "./ui";

const WHO = {
  narrator: { label: "", color: C.fg },
  likhit: { label: "Likhit", color: C.accent },
  student: { label: "Student", color: C.listen },
};

/** Burned-in caption for one clip: most LinkedIn/X viewers watch muted. */
const Caption: React.FC<{ id: ClipId; dur: number }> = ({ id, dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const c = CAPTIONS[id];
  const who = WHO[c.who];
  const opacity = interpolate(frame, [0, 4, dur * fps - 4, dur * fps], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 56, opacity }}>
      <div
        style={{
          maxWidth: 1500,
          fontFamily,
          fontSize: 40,
          lineHeight: 1.35,
          fontWeight: 600,
          color: C.fg,
          background: "rgba(10,10,14,0.78)",
          borderRadius: 18,
          padding: "14px 30px",
          textAlign: "center",
        }}
      >
        {who.label && <span style={{ color: who.color, marginRight: 14 }}>{who.label}:</span>}
        {c.en ?? c.text}
      </div>
    </AbsoluteFill>
  );
};

const SCENE_COMPONENTS: Record<SceneId, React.FC> = {
  hook: Hook,
  problem: Problem,
  intro: Intro,
  question: Question,
  dictate: Dictate,
  edit: Edit,
  readback: Readback,
  audit: Audit,
  outro: Outro,
};

export const Likhit: React.FC = () => {
  const { fps } = useVideoConfig();
  const f = (s: number) => Math.round(s * fps);
  const clips = Object.keys(AT) as ClipId[];
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Backdrop />
      <Track name="Scenes">
        {(Object.keys(SCENES) as SceneId[]).map((id) => {
          const [a, b] = SCENES[id];
          const Comp = SCENE_COMPONENTS[id];
          return (
            <Sequence key={id} name={id} from={f(a)} durationInFrames={f(b) - f(a)}>
              <Comp />
            </Sequence>
          );
        })}
      </Track>
      <Track name="Voiceover (Gnani Timbre)">
        {clips.map((id) => (
          <Audio key={id} name={id} src={staticFile(`vo/${id}.wav`)} from={f(AT[id].start)} />
        ))}
      </Track>
      <Track name="Captions">
        {clips.map((id) => (
          <Sequence
            key={id}
            name={`cap ${id}`}
            from={f(AT[id].start)}
            durationInFrames={f(AT[id].end) - f(AT[id].start)}
          >
            <Caption id={id} dur={AT[id].end - AT[id].start} />
          </Sequence>
        ))}
      </Track>
    </AbsoluteFill>
  );
};
