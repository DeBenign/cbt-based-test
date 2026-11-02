import React from "react";
import { Composition } from "remotion";
import { FPS, totalFrames } from "./config";
import { Video } from "./Video";

const Pitch: React.FC = () => <Video kind="pitch" />;
const Teaser: React.FC = () => <Video kind="teaser" />;
const Demo: React.FC = () => <Video kind="demo" />;

export const Root: React.FC = () => (
  <>
    <Composition id="Pitch" component={Pitch} durationInFrames={totalFrames("pitch")} fps={FPS} width={1920} height={1080} />
    <Composition id="Teaser" component={Teaser} durationInFrames={totalFrames("teaser")} fps={FPS} width={1080} height={1920} />
    <Composition id="Demo" component={Demo} durationInFrames={totalFrames("demo")} fps={FPS} width={1920} height={1080} />
  </>
);
