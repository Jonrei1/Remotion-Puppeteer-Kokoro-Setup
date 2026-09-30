import { Config } from "@remotion/cli/config";
// Optional Tailwind v4:
// import { enableTailwind } from "@remotion/tailwind-v4";

Config.setEntryPoint("video/src/index.ts");
Config.setPublicDir("video/public");
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(92);
Config.setOverwriteOutput(true);
// Config.overrideWebpackConfig((current) => enableTailwind(current));
