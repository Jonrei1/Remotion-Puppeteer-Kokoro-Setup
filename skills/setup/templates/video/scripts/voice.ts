import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { KokoroTTS } from "kokoro-js";
import { NARRATION, VOICE, lineTiming, type ManifestLines } from "../src/data/narration";
import { FPS, TOTAL_FRAMES } from "../src/timeline";
import { encodeWav } from "./wav";

const root = process.cwd();
const voiceDir = path.join(root, "video", "public", "voice");
const manifestPath = path.join(root, "video", "src", "data", "voice-manifest.json");
const GAP = 6; // frames of breathing room required between lines
const PIPELINE = "trim+norm-19"; // bump when processing changes, to regenerate all clips

function trim(s: Float32Array, rate: number): Float32Array {
  const threshold = 0.01;
  const pad = Math.round(0.03 * rate);
  let start = s.findIndex((v) => Math.abs(v) > threshold);
  let end = s.length - 1;
  while (end > 0 && Math.abs(s[end]) <= threshold) end--;
  if (start < 0) return s;
  start = Math.max(0, start - pad);
  end = Math.min(s.length, end + pad);
  return s.slice(start, end);
}

const TARGET_RMS = 10 ** (-19 / 20);
function normalise(s: Float32Array): Float32Array {
  let peak = 0;
  let sum = 0;
  for (const v of s) {
    peak = Math.max(peak, Math.abs(v));
    sum += v * v;
  }
  const rms = Math.sqrt(sum / (s.length || 1));
  const gain = Math.min(0.98 / (peak || 1), TARGET_RMS / (rms || 1));
  return s.map((v) => v * gain);
}

async function main() {
  mkdirSync(voiceDir, { recursive: true });
  const previous: ManifestLines = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")).lines ?? {} : {};
  const lines: ManifestLines = {};
  let tts: KokoroTTS | null = null;

  for (const line of NARRATION) {
    const spoken = line.say ?? line.text;
    const hash = createHash("sha1").update(JSON.stringify([spoken, VOICE.name, VOICE.speed, PIPELINE])).digest("hex").slice(0, 12);
    const file = path.join(voiceDir, `${line.id}.wav`);
    if (previous[line.id]?.hash === hash && existsSync(file)) {
      lines[line.id] = previous[line.id];
      continue;
    }
    // First use downloads the model (~90 MB); later runs load it from the cache.
    tts ??= await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", { dtype: "q8", device: "cpu" });
    const audio = await tts.generate(spoken, { voice: VOICE.name, speed: VOICE.speed });
    const samples = normalise(trim(audio.audio, audio.sampling_rate));
    writeFileSync(file, encodeWav(samples, audio.sampling_rate));
    lines[line.id] = { frames: Math.ceil((samples.length / audio.sampling_rate) * FPS), hash };
    console.log(`✓ voice/${line.id}.wav  ${(samples.length / audio.sampling_rate).toFixed(2)}s  "${spoken}"`);
  }

  writeFileSync(manifestPath, `${JSON.stringify({ voice: VOICE.name, lines }, null, 2)}\n`);

  const problems: string[] = [];
  const timed = NARRATION.map((line) => ({ line, ...lineTiming(line, lines) })).sort((a, b) => a.from - b.from);
  timed.forEach(({ line, from, frames }, i) => {
    const end = from + frames;
    const next = timed[i + 1];
    if (next && end + GAP > next.from) problems.push(`"${line.id}" ends at ${end}, overlapping "${next.line.id}" (starts ${next.from}).`);
    if (end > TOTAL_FRAMES) problems.push(`"${line.id}" runs ${end - TOTAL_FRAMES}f past the end of the video.`);
  });
  if (problems.length > 0) {
    console.error(`Timing problems:\n- ${problems.join("\n- ")}`);
    process.exit(1);
  }
  console.log("✓ Narration fits the timeline.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
