# Remotion + Playwright + Chromium + Kokoro TTS setup (Claude Code plugin)

A Claude Code plugin that sets up the tooling for code-driven videos with a local AI
voiceover in any project, then verifies it. **Setup only:** it installs and wires everything,
renders a 10-second test with one spoken line, and then asks you to describe the actual video
(purpose, length, theme, scenes, script).

| Piece | Version | Role |
|---|---|---|
| [Remotion](https://www.remotion.dev) | 4.0.530 | Videos written in React, rendered to MP4 |
| Chrome Headless Shell | managed by Remotion | The browser Remotion renders in (driven through Remotion's built-in Puppeteer fork) |
| [Playwright](https://playwright.dev) + Chromium | 1.63.0 | Captures screenshots and the live UI of a local app for reference |
| [Kokoro TTS](https://huggingface.co/hexgrad/Kokoro-82M) (`kokoro-js`) | 1.2.1 | Local text-to-speech, voice **`af_bella`** at speed **1.06** |

Everything runs locally. There's no API key or cloud TTS.

## Install

In Claude Code:

```
/plugin marketplace add Jonrei1/Remotion-Puppeteer-Kokoro-Setup
```

```
/plugin install remotion-video-setup@remotion-kokoro-setup
```

Or from a terminal:

```bash
claude plugin marketplace add Jonrei1/Remotion-Puppeteer-Kokoro-Setup
```

```bash
claude plugin install remotion-video-setup@remotion-kokoro-setup
```

## Use

Open the project that should get the video tooling and run:

```
/remotion-video-setup:setup
```

Claude then works through these steps:
1. **Checks:** Node 20+ and a `package.json`, and asks before touching any existing file.
2. **Downloads:** tells you what will be downloaded (about 600 MB in total) and waits for your yes.
3. **Install:** installs the pinned packages, Remotion's Chrome Headless Shell and Playwright's
   Chromium.
4. **Files:** copies the project files into `video/`, plus `remotion.config.ts`, the npm
   scripts and a `.gitignore`. The `.gitignore` keeps `node_modules` (including the
   downloaded Chrome and the Kokoro model), renders, voice clips and `.env` out of git, even
   when the video lives in its own folder inside a bigger repo.
5. **Verification:**
   - a type check;
   - a voice test in `af_bella` (the first run downloads the ~90 MB Kokoro model);
   - a full render with the A/V sync step;
   - a stream check;
   - a Playwright launch.
6. **Hand-over:** asks you to describe the video.

After setup, the project has these commands:

| Command | What it does |
|---|---|
| `npm run video:studio` | Remotion Studio (live preview) |
| `npm run video:voice` | Generates the voiceover from `video/src/data/narration.ts` |
| `npm run video:capture` | Playwright screenshots of a local app (localhost only, login from `.env`) |
| `npm run video:render` | Voice, then render, then re-mux the audio in sync → `video/out/video.mp4` |

## What's in this repo

```
.claude-plugin/
  plugin.json          the plugin
  marketplace.json     this repo as a one-plugin marketplace
skills/setup/
  SKILL.md             the setup procedure Claude follows
  SETUP.md             the full human-readable guide (also usable without Claude)
  templates/           the files copied into your project, in their final layout
```

To set a project up by hand, follow [`skills/setup/SETUP.md`](skills/setup/SETUP.md).

## Notes

- **Voice:** `af_bella` is fixed on purpose. To change it, edit `VOICE` in
  `video/src/data/narration.ts`; every clip regenerates on the next run.
- **A/V sync:** Remotion's AAC track starts about 43 ms late (unflagged encoder priming). The
  render script re-muxes a lossless WAV render so the voice lands within about 1 ms of its
  frame.
- **Licensing:**
  - Remotion is free for individuals and companies of up to 3 people; larger companies need a
    [company license](https://www.remotion.dev/license).
  - Kokoro-82M, `kokoro-js` and Playwright are Apache-2.0.
