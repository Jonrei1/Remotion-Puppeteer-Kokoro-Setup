import { Composition } from "remotion";
import { Main } from "./Main";
import { FPS, HEIGHT, TOTAL_FRAMES, WIDTH } from "./timeline";

export const RemotionRoot = () => (
  <Composition id="Main" component={Main} durationInFrames={TOTAL_FRAMES} fps={FPS} width={WIDTH} height={HEIGHT} />
);
