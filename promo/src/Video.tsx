import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile } from "remotion";
import { Backdrop } from "./Layout";
import {
  HAS_MUSIC, HAS_VOICE, MUSIC_VOLUME_SOLO, MUSIC_VOLUME_WITH_VOICE, ROLE_OF, SceneId, TIMELINES, VideoKind, sec, totalFrames,
} from "./config";
import { Hook } from "./scenes/Hook";
import { Setup } from "./scenes/Setup";
import { Curriculum } from "./scenes/Curriculum";
import { AIQuestions } from "./scenes/AIQuestions";
import { ExamBuilder } from "./scenes/ExamBuilder";
import { Grading } from "./scenes/Grading";
import { StudentResult } from "./scenes/StudentResult";
import { Activity } from "./scenes/Activity";
import { Onboarding } from "./scenes/Onboarding";
import { Login } from "./scenes/Login";
import { Exam } from "./scenes/Exam";
import { Results } from "./scenes/Results";
import { ManualPay } from "./scenes/ManualPay";
import { OnlinePay } from "./scenes/OnlinePay";
import { Mail } from "./scenes/Mail";
import { Outro } from "./scenes/Outro";

const SCENES: Record<SceneId, React.FC<{ tag?: string }>> = {
  hook: Hook, setup: Setup, onboarding: Onboarding, login: Login, curriculum: Curriculum,
  aiQuestions: AIQuestions, examBuilder: ExamBuilder, exam: Exam, results: Results, grading: Grading,
  studentResult: StudentResult, activity: Activity, manualPay: ManualPay, onlinePay: OnlinePay,
  mail: Mail, outro: Outro,
};

export const Video: React.FC<{ kind: VideoKind }> = ({ kind }) => {
  const timeline = TIMELINES[kind];
  const total = totalFrames(kind);
  const steps = timeline.filter((x) => x.id !== "hook" && x.id !== "outro");
  const musicVolume = HAS_VOICE[kind] ? MUSIC_VOLUME_WITH_VOICE : MUSIC_VOLUME_SOLO;
  let from = 0;
  return (
    <AbsoluteFill>
      <Backdrop />
      {timeline.map((item) => {
        const duration = sec(item.sec);
        const start = from;
        from += duration;
        const Scene = SCENES[item.id];
        // numbered "Step n of N" labels only on the walkthrough video
        const stepIndex = steps.findIndex((x) => x.id === item.id);
        const tag = kind === "demo" && stepIndex >= 0 ? `Step ${stepIndex + 1} of ${steps.length} · ${ROLE_OF[item.id]}` : undefined;
        return (
          <Sequence key={item.id} from={start} durationInFrames={duration}>
            <Scene tag={tag} />
            {HAS_VOICE[kind] && <Audio src={staticFile(`voice/${kind}/${item.id}.mp3`)} />}
          </Sequence>
        );
      })}
      {HAS_MUSIC && (
        <Audio
          src={staticFile("music.mp3")}
          loop
          volume={(f) =>
            interpolate(f, [0, 30, total - 60, total], [0, musicVolume, musicVolume, 0], {
              extrapolateLeft: "clamp", extrapolateRight: "clamp",
            })
          }
        />
      )}
    </AbsoluteFill>
  );
};
