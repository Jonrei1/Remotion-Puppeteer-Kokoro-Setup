import manifest from "./voice-manifest.json";

export type NarrationLine = { id: string; at: number; text: string; say?: string };
export type ManifestLines = Record<string, { frames: number; hash: string }>;

// af_bella is Kokoro's most expressive voice; speed 1.06 keeps the read lively.
// Kokoro takes intonation from punctuation: "!" lifts, "," pauses briefly.
export const VOICE = { name: "af_bella", speed: 1.06 } as const;

// `at` is the frame the line starts on. Replace with your script.
export const NARRATION: NarrationLine[] = [
  { id: "test", at: 15, text: "This is a voice test for the new video." },
];

const LINES: ManifestLines = (manifest as { lines?: ManifestLines }).lines ?? {};

export function lineTiming(line: NarrationLine, lines: ManifestLines = LINES) {
  const frames = lines[line.id]?.frames;
  return { from: line.at, frames: frames ?? 0, voiced: frames !== undefined };
}
