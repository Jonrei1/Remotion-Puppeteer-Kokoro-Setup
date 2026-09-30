# Remotion video setup: Remotion + Playwright + Chromium + Kokoro TTS

A portable setup guide for building code-driven videos with a local AI voiceover. It sets up
the tooling only. The video's content, theme, scenes and script are yours to describe
afterwards (see [Next: describe your video](#next-describe-your-video)).

Everything runs locally and is free for this use:

| Piece | Version (known good) | Role |
|---|---|---|
| Node.js | 20+ (tested on 24.18) | Runs everything |
| [Remotion](https://www.remotion.dev) | 4.0.530 (all `@remotion/*` pinned to the same version) | Videos written in React, rendered to MP4 |
| Chrome Headless Shell | managed by Remotion | The browser Remotion renders frames in |
| [Playwright](https://playwright.dev) + Chromium | 1.63.0 | Opens a real app and takes screenshots or reads the live UI as reference |
| [Kokoro TTS](https://huggingface.co/hexgrad/Kokoro-82M) via `kokoro-js` | 1.2.1 | Local text-to-speech voiceover (Apache-2.0, commercial use OK) |
| Voice | `af_bella`, speed `1.06` | Kokoro's most expressive voice, slightly brisk |
| `tsx` | 4.x | Runs the TypeScript scripts |

> **Two different Chromiums.** Remotion renders with its own **Chrome Headless Shell**.
> Playwright uses its own **Chromium** to visit and capture a real app. They're separate
> downloads and both are needed.

---

## 1. Prerequisites

- **Node.js 20 or newer.** Check with `node -v`.
- **Disk:** about 600 MB for the two browsers, the Kokoro model (about 90 MB) and dependencies.
- **Linux only:** browser system libraries. `npx playwright install --with-deps chromium`
  (step 4) installs them, and they also cover Remotion's headless shell.
- **Windows:** everything works in PowerShell. See [Troubleshooting](#troubleshooting) for
  quoting quirks.

## 2. Install Remotion

In a new or existing project:

```bash
npm install --save-exact remotion@4.0.530 @remotion/cli@4.0.530 @remotion/bundler@4.0.530 @remotion/renderer@4.0.530 @remotion/transitions@4.0.530 @remotion/google-fonts@4.0.530
```

```bash
npm install react react-dom
```

```bash
npm install --save-dev --save-exact typescript tsx @types/react @types/node
```

Every `@remotion/*` package must be the **same exact version** as `remotion`. Mixed versions
fail at render time. To upgrade later, run `npx remotion upgrade`.

**Optional: Tailwind v4 inside the video**

```bash
npm install --save-exact @remotion/tailwind-v4@4.0.530 tailwindcss@4
```

## 3. Download Remotion's browser

```bash
npx remotion browser ensure
```

This downloads Chrome Headless Shell once. Renders also download it automatically, but doing
it now surfaces network or proxy problems early.

## 4. Install Playwright and its Chromium

```bash
npm install --save-dev --save-exact playwright@1.63.0
```

```bash
npx playwright install chromium
```

On Linux, add `--with-deps` to install the system libraries too.

## 5. Install Kokoro TTS

```bash
npm install --save-dev --save-exact kokoro-js@1.2.1
```

- **Model download.** The first voice generation downloads `onnx-community/Kokoro-82M-v1.0-ONNX`
  (q8, about 90 MB) from Hugging Face into
  `node_modules/@huggingface/transformers/.cache/`. Later runs are offline.
- **Blocked install scripts.** If npm blocks install scripts (`allow-scripts`, `ignore-scripts`),
  `onnxruntime-node` still works: its prebuilt binary ships in the package. Only allow its
  script if generation fails with a missing-binary error.

---

## 6. Project layout

All video code lives in `video/`, so it stays out of the way of an app in the same repo:

```
remotion.config.ts            Remotion CLI/Studio config (repo root)
video/
  src/
    index.ts                  entry: registerRoot
    Root.tsx                  compositions
    Main.tsx                  the video (placeholder until you describe it)
    timeline.ts               fps, size, length
    styles.css                global CSS (optional Tailwind)
    components/Narration.tsx  plays the voice clips on the timeline
    data/narration.ts         the voiceover script (one source for audio)
    data/voice-manifest.json  generated clip lengths (commit this)
  scripts/
    voice.ts                  Kokoro TTS → video/public/voice/*.wav
    wav.ts                    WAV encoder
    mux-audio.ts              final A/V sync step
  capture/
    capture.ts                Playwright screenshots of a local app
  public/                     static files (staticFile()) incl. generated voice/
  out/                        renders (gitignored)
```

## 7. Configuration files

### `remotion.config.ts` (repo root)

```ts
import { Config } from "@remotion/cli/config";
// Optional Tailwind v4:
// import { enableTailwind } from "@remotion/tailwind-v4";

Config.setEntryPoint("video/src/index.ts");
Config.setPublicDir("video/public");
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(92);
Config.setOverwriteOutput(true);
// Config.overrideWebpackConfig((current) => enableTailwind(current));
```

If you write a custom webpack override that needs paths, resolve them from `process.cwd()`,
not `__dirname`. Remotion bundles the config into its own folder, so `__dirname` points there.

### `tsconfig.json` (if the project doesn't have one)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["video", "remotion.config.ts"]
}
```

`resolveJsonModule` is required, because the voice manifest is imported as JSON.

### `video/src/timeline.ts`

```ts
export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;
// Placeholder length; set it once the video is described.
export const TOTAL_FRAMES = 10 * FPS;
```

### `video/src/index.ts`

```ts
import { registerRoot } from "remotion";
import "./styles.css";
import { RemotionRoot } from "./Root";

registerRoot(RemotionRoot);
```

### `video/src/styles.css`

```css
/* With Tailwind v4 enabled: */
/* @import "tailwindcss"; */

/* Frames render independently and out of order, so wall-clock CSS motion
   (transitions, keyframe animations, caret blink) would differ per frame.
   All motion must come from useCurrentFrame(). Wrap the video in .video-root. */
.video-root *,
.video-root *::before,
.video-root *::after {
  transition: none !important;
  animation: none !important;
  caret-color: transparent !important;
}
```

### `video/src/Root.tsx`

```tsx
import { Composition } from "remotion";
import { Main } from "./Main";
import { FPS, HEIGHT, TOTAL_FRAMES, WIDTH } from "./timeline";

export const RemotionRoot = () => (
  <Composition id="Main" component={Main} durationInFrames={TOTAL_FRAMES} fps={FPS} width={WIDTH} height={HEIGHT} />
);
```

### `video/src/Main.tsx` (placeholder)

```tsx
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
```

**Fonts:** load Google fonts with `@remotion/google-fonts` (for example
`import { loadFont } from "@remotion/google-fonts/Poppins"`). `next/font` and other
framework font loaders don't run inside Remotion.

---

## 8. Voiceover with Kokoro TTS (voice `af_bella`)

One script file drives the audio. Each line has an `id`, the frame it starts at, its text, and
optionally a spoken form (`say`) where pronunciation differs from the written text.

### `video/src/data/voice-manifest.json` (create it once)

```json
{ "voice": "af_bella", "lines": {} }
```

### `video/src/data/narration.ts`

```ts
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
```

### `video/scripts/wav.ts`

```ts
// 16-bit PCM WAV: one channel (mono) or several of equal length.
export function encodeWav(samples: Float32Array | Float32Array[], rate: number): Buffer {
  const channels = Array.isArray(samples) ? samples : [samples];
  const frames = channels[0].length;
  const data = Buffer.alloc(frames * channels.length * 2);
  for (let i = 0; i < frames; i++) {
    channels.forEach((ch, c) => {
      data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, ch[i])) * 32767), (i * channels.length + c) * 2);
    });
  }
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write("WAVE", 8);
  h.write("fmt ", 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(channels.length, 22);
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * channels.length * 2, 28);
  h.writeUInt16LE(channels.length * 2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}
```

### `video/scripts/voice.ts`

This script generates one WAV per line and records each clip's length in the manifest.
- **Skipping:** unchanged lines (same text, voice, speed and processing) are skipped.
- **Processing:** each clip is trimmed to the voice, so `at` is where speech actually starts, and levelled to -19 dBFS.
- **Checks:** the script fails if a line runs into the next one or past the end.

```ts
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
```

### `video/src/components/Narration.tsx`

```tsx
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
```

**Other voices:** Kokoro's American English voices include `af_heart` (warm, calm),
`af_bella` (expressive, used here), `af_nicole` (soft), `am_michael` and `am_fenrir` (male).
To switch, change `VOICE.name`. The hash changes, so every clip regenerates on the next run.

---

## 9. Playwright capture (reference screenshots of a real app)

This is useful when the video depicts an existing web app: capture its pages at the video's
resolution to use as reference or backgrounds. The script only visits a **local** dev server,
and credentials come from `.env`, never from code.

### `video/capture/capture.ts`

```ts
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const BASE_URL = process.env.CAPTURE_URL ?? "http://localhost:3000";
// Replace with the routes the video needs.
const ROUTES = ["/"];
const outDir = path.join(process.cwd(), "video", "public", "captures");

function assertLocal(url: string) {
  const { hostname } = new URL(url);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(hostname)) {
    throw new Error(`Refusing to capture ${hostname}: only local dev servers.`);
  }
}

async function main() {
  assertLocal(BASE_URL);
  mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    colorScheme: "light",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();

  // If the app needs a login, sign in here with values from .env
  // (process.env.CAPTURE_USER / CAPTURE_PASS). Never hard-code or print them.

  for (const route of ROUTES) {
    await page.goto(new URL(route, BASE_URL).toString(), { waitUntil: "networkidle" });
    const name = route === "/" ? "home" : route.replace(/^\//, "").replace(/\//g, "-");
    await page.screenshot({ path: path.join(outDir, `${name}.png`) });
    console.log(`✓ captures/${name}.png`);
  }
  await browser.close();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
```

---

## 10. Rendering with correct A/V sync

Remotion's AAC audio starts with the encoder's priming samples (about 43 ms of silence), and
they aren't flagged for players to skip, so the soundtrack plays about 1.3 frames late. The
render script therefore also renders the audio as lossless WAV and re-muxes it with ffmpeg,
which records the encoder delay properly. The picture stream is copied untouched.

### `video/scripts/mux-audio.ts`

```ts
import { spawnSync } from "node:child_process";
import { existsSync, renameSync, unlinkSync } from "node:fs";
import path from "node:path";

const out = path.join("video", "out");
const video = path.join(out, "video.mp4");
const audio = path.join(out, "video.wav");
const tmp = path.join(out, "video.synced.mp4");

for (const file of [video, audio]) {
  if (!existsSync(file)) {
    console.error(`Missing ${file}; run npm run video:render.`);
    process.exit(1);
  }
}

const args = ["remotion", "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", video, "-i", audio, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "320k", "-movflags", "+faststart", tmp];
// One command string (paths are fixed and space-free) so npx resolves on Windows too.
const run = spawnSync(`npx ${args.join(" ")}`, { stdio: "inherit", shell: true });
if (run.status !== 0) {
  console.error("ffmpeg failed; the unsynced render is left in place.");
  process.exit(1);
}
renameSync(tmp, video);
unlinkSync(audio);
console.log(`✓ ${video}: soundtrack re-muxed in sync with the picture`);
```

### `package.json` scripts

```json
{
  "scripts": {
    "video:studio": "remotion studio",
    "video:voice": "tsx video/scripts/voice.ts",
    "video:capture": "tsx --env-file=.env video/capture/capture.ts",
    "video:render": "npm run video:voice && remotion render Main video/out/video.mp4 && remotion render Main video/out/video.wav --codec=wav && tsx video/scripts/mux-audio.ts"
  }
}
```

`video:capture` expects a `.env` file to exist (it can be empty). Remove `--env-file=.env`
if the app needs no login.

### `.gitignore`

Put this in the folder that holds the video's `package.json`. It works whether that folder is its own repo or sits inside a larger one, because the patterns are unanchored. It keeps every dependency out of git: `node_modules/` also covers Remotion's Chrome Headless Shell (`node_modules/.remotion/`) and the Kokoro model (`node_modules/@huggingface/transformers/.cache/`). Playwright's Chromium goes to a per-user cache outside the project.

```gitignore
# Dependencies: never tracked, restore with `npm install`. This also covers
# the big downloads, which live inside node_modules:
#   node_modules/.remotion/                        Remotion's Chrome Headless Shell
#   node_modules/@huggingface/transformers/.cache/ the Kokoro TTS model
# (Playwright's Chromium goes to a per-user cache outside the project.)
# Unanchored, so it matches in this folder and any folder below it.
node_modules/
.pnpm-store/
.yarn/

# Package manager and build leftovers
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
*.tsbuildinfo

# Secrets: capture logins live in .env and must never be committed
.env
.env.*
!.env.example

# Renders, captures and generated audio stay on the machine
# (the voice WAVs are regenerated from video/src/data/voice-manifest.json,
# which IS committed)
video/out/
out/
video/public/captures/
video/public/voice/
*.mp4
*.mov
*.webm

# OS files
.DS_Store
Thumbs.db
```

Commit `package-lock.json` (so reinstalls get the same versions) and `video/src/data/voice-manifest.json`. The WAVs are regenerated from the script.

---

## 11. Verify the setup

Run these in order. Each proves one part works.

1. **Remotion Studio opens** with the blank `Main` composition:

   ```bash
   npm run video:studio
   ```

2. **Kokoro speaks in the `af_bella` voice.** The first run downloads the model, then writes
   `video/public/voice/test.wav` and prints `✓ Narration fits the timeline.`:

   ```bash
   npm run video:voice
   ```

3. **A full render works** and produces `video/out/video.mp4` with the test line audible at 0.5s:

   ```bash
   npm run video:render
   ```

4. **The output has video and audio streams** of matching length:

   ```bash
   npx remotion ffprobe -v error -show_entries stream=codec_type,duration -of compact video/out/video.mp4
   ```

5. **Playwright works.** With a local app running, this writes `video/public/captures/home.png`:

   ```bash
   npm run video:capture
   ```

When all five pass, the setup is done. Replace the placeholder `Main`, `TOTAL_FRAMES` and
`NARRATION` when you describe the video.

---

## Troubleshooting

- **Version mismatch errors at render.** Every `@remotion/*` package must match `remotion`
  exactly. Pin them with `--save-exact`, or run `npx remotion upgrade`.
- **Kokoro fails with a missing onnxruntime binary.** Your npm config blocked
  `onnxruntime-node`'s install script and no prebuilt binary matched your platform. Allow that
  one package's script, or run `npm rebuild onnxruntime-node`.
- **Model download hangs.** It fetches from huggingface.co. Check proxy or firewall access, or
  copy an existing `node_modules/@huggingface/transformers/.cache/` folder from another machine.
- **Animations flicker or differ between frames.** Something animates on wall-clock time (CSS
  transitions or keyframes, `Date.now()`, `setTimeout`). Derive all motion from
  `useCurrentFrame()`, and keep the `.video-root` reset in `styles.css`.
- **Remotion's bundled ffmpeg is minimal.** Some filters (for example `select`) and raw
  muxers (for example `s16le`) are missing. Use `-f wav` for PCM, and seek with `-ss` to grab
  single frames.
- **PowerShell mangles quotes** passed to `node -e` or to ffmpeg filter strings. Put the logic
  in a `.ts` file and run it with `npx tsx`, or run the command from Git Bash.
- **The voice sounds flat.** Kokoro reads punctuation: use `!` for energy, commas for small
  pauses and short sentences. Adjust `VOICE.speed` in small steps (1.0–1.1).
- **Studio fails to import `voice-manifest.json`.** Create it (section 8) before starting
  Studio, and keep `resolveJsonModule` on.

## Licensing notes

- **Remotion** is free for individuals and companies of up to 3 people. Larger companies need
  a [company license](https://www.remotion.dev/license).
- **Kokoro-82M** model weights and **kokoro-js** are Apache-2.0: commercial use is allowed.
- **Playwright** is Apache-2.0.

---

## Next: describe your video

The setup is complete once section 11 passes. To build the actual video, describe:

- **Purpose and audience:** promo, walkthrough, launch teaser, tutorial.
- **Length, aspect and resolution:** for example 60s at 1920×1080, or 30s vertical at 1080×1920.
- **Theme:** colours and fonts (or a brand or design system to follow), mood, pacing.
- **Scenes:** what appears in order, and whether it shows a real app (the Playwright capture)
  or designed graphics.
- **Voiceover script:** the lines, or the key points to write them from. The voice stays
  `af_bella` unless you choose another.
- **Extras:** subtitles, music, sound effects, transitions style, reference videos.
