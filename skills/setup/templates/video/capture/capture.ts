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
