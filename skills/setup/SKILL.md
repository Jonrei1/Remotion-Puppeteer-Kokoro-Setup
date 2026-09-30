---
name: setup
description: Set up a Remotion video project in the current repo with Chromium (Remotion's Chrome Headless Shell), Playwright + Chromium for capturing a local app, and a local Kokoro TTS voiceover (voice af_bella, speed 1.06). Tooling only; it builds no video content.
argument-hint: "[target folder, default: current project root]"
disable-model-invocation: true
---

# Remotion + Playwright + Chromium + Kokoro TTS setup

Set up the tooling for code-driven videos with a local AI voiceover in the user's project. This
skill only installs and wires the tooling, then proves it works. **Do not build scenes, pick a
theme or write a script.** The user describes the video afterwards.

The complete guide, with the reasoning behind every file, is in `${CLAUDE_SKILL_DIR}/SETUP.md`.
The ready-to-copy files are in `${CLAUDE_SKILL_DIR}/templates/`, laid out exactly as they
go into the project.

## Fixed choices (do not change unless the user asks)

| Piece | Version |
|---|---|
| `remotion` and every `@remotion/*` package | `4.0.530`, exact, all identical |
| `playwright` | `1.63.0`, exact |
| `kokoro-js` | `1.2.1`, exact |
| Voice | `af_bella`, speed `1.06` (set in `video/src/data/narration.ts`) |
| Format | 1920×1080, 30 fps, placeholder length 10 s |

## Steps

### 1. Check the ground

- **Node version:** run `node -v`. It must be 20 or newer; if not, stop and tell the user.
- **Project root:** the target folder is `$ARGUMENTS` if given, otherwise the current project
  root. Every command below runs from there: Remotion treats the folder with `package.json` as
  the project root, and running from a subfolder picks the wrong one.
- **`package.json`:** if there isn't one, run `npm init -y`.
- **Existing files:** look for any that would collide: `remotion.config.ts`, `video/`,
  `tsconfig.json`. Never overwrite an existing file silently. For each collision, show the user
  what differs and ask whether to merge, skip or replace.

### 2. Confirm the downloads

Before installing, tell the user what will be downloaded and wait for a yes:
- npm packages: about 250 MB in `node_modules`;
- Remotion's Chrome Headless Shell: about 100 MB;
- Playwright's Chromium: about 150 MB;
- the Kokoro-82M ONNX model (q8): about 90 MB, from huggingface.co on the first voice run.

### 3. Install

```bash
npm install --save-exact remotion@4.0.530 @remotion/cli@4.0.530 @remotion/bundler@4.0.530 @remotion/renderer@4.0.530 @remotion/transitions@4.0.530 @remotion/google-fonts@4.0.530
```

```bash
npm install react react-dom
```

```bash
npm install --save-dev --save-exact typescript tsx @types/react @types/node playwright@1.63.0 kokoro-js@1.2.1
```

```bash
npx remotion browser ensure
```

```bash
npx playwright install chromium
```

- **Linux:** add `--with-deps` to the Playwright install for the system libraries.
- **React already installed:** if the project has React below 18, stop and ask; Remotion 4
  needs React 18 or 19.
- **Tailwind:** only if the user asks for it, also install `@remotion/tailwind-v4@4.0.530` and
  `tailwindcss@4`, then uncomment the Tailwind lines in `remotion.config.ts` and `styles.css`.

### 4. Copy the templates

Copy everything under `${CLAUDE_SKILL_DIR}/templates/` into the project, keeping paths, with
these exceptions:
- **`package.scripts.json`:** don't copy it. Merge its `scripts` into the project's
  `package.json`. Keep existing scripts, and ask if a name clashes.
- **`gitignore`:** it becomes the `.gitignore` of the target folder (the one with the video's
  `package.json`), so that folder's `node_modules`, the downloaded browser, the Kokoro model,
  renders, voice clips and `.env` are never tracked. This holds even when the folder sits
  inside a larger repo. If a `.gitignore` already exists there, append only the lines it
  lacks. Keep `package-lock.json` and `video/src/data/voice-manifest.json` tracked.
- **`tsconfig.json`:** copy it only if the project has none. Otherwise make sure the existing
  one has `"resolveJsonModule": true` and `"jsx": "react-jsx"`, and that it includes `video`
  and `remotion.config.ts`. If the project is an app with its own build (Next.js, Vite), check
  that including `video/` doesn't break that build; if it does, give `video/` its own
  `tsconfig.json` instead.

`video/src/data/voice-manifest.json` must exist before Studio or a render starts; it's in
the templates.

### 5. Verify (all five must pass)

1. `npx tsc --noEmit` passes, at least for the files under `video/`.
2. `npm run video:voice` prints `✓ voice/test.wav …` and `✓ Narration fits the timeline.`. The
   first run downloads the model.
3. `npm run video:render` produces `video/out/video.mp4` and ends with
   `✓ … soundtrack re-muxed in sync with the picture`.
4. Streams check:
   ```bash
   npx remotion ffprobe -v error -show_entries stream=codec_type,duration -of compact video/out/video.mp4
   ```
   It must show a video and an audio stream, both 10 seconds long.
5. Playwright launches Chromium (no quoting, so it works in any shell):
   ```bash
   npx playwright screenshot --browser chromium about:blank video/out/playwright-check.png
   ```
   It must write that file. Delete the file afterwards. Run `npm run video:capture` only if the
   user has a local app running and wants reference screenshots.

Don't start `npm run video:studio` yourself (it's a long-running server); tell the user it's
available.

If something fails, check the Troubleshooting section of `${CLAUDE_SKILL_DIR}/SETUP.md` before
changing any file. The common causes:
- mismatched `@remotion/*` versions;
- a blocked `onnxruntime-node` install script;
- PowerShell mangling quotes;
- the Remotion CLI run from a subfolder.

### 6. Hand over

Report which files were added or changed and what each check printed. Then end with the
"Next: describe your video" checklist from `SETUP.md`:
- purpose;
- length and format;
- theme;
- scenes;
- the voiceover script;
- extras.

Ask the user to describe the video. Don't build any of it until they do.

## Safety

- **Local-only capture:** the capture script refuses any host except localhost. Don't remove
  that guard.
- **Credentials:** they only ever come from `.env` (`CAPTURE_USER`/`CAPTURE_PASS`). Never ask
  for them in chat, write them into code or print them.
- **No commits:** don't commit anything unless the user asks.
- **Licence:** Remotion needs a paid company licence for companies of more than 3 people.
  Mention this once in the hand-over.
