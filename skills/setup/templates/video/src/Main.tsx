import { AbsoluteFill } from "remotion";
import { Narration } from "./components/Narration";

export function Main() {
  return (
    <AbsoluteFill className="video-root" style={{ background: "white" }}>
      {/* Scenes go here once the video is described. */}
      <Narration />
    </AbsoluteFill>
  );
}
