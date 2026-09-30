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
