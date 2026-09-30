import { Audio, Sequence, getStaticFiles, staticFile } from "remotion";
import { NARRATION, lineTiming } from "../data/narration";

// Plays each generated clip at its frame. Lines without a clip yet are
// skipped, so the video still renders before the voice exists.
export function Narration() {
  const files = new Set(getStaticFiles().map((file) => file.name));
  return (
    <>
      {NARRATION.map((line) => {
        const src = `voice/${line.id}.wav`;
        const { from, frames, voiced } = lineTiming(line);
        if (!voiced || !files.has(src)) return null;
        return (
          <Sequence key={line.id} from={from} durationInFrames={frames + 6} layout="none" name={`voice ${line.id}`}>
            <Audio src={staticFile(src)} />
          </Sequence>
        );
      })}
    </>
  );
}
