import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// WebKit on Windows exercises the browser engine, not Safari on an Apple device.
export default defineConfig({
  ...base,
  testMatch: [
    "web-platform.spec.ts",
    "web-media.spec.ts",
    "posts.spec.ts",
    "demo-world.spec.ts",
  ],
  outputDir: "artifacts/ui-cross-platform",
  projects: [
    {
      name: "firefox",
      use: { ...base.use, channel: undefined, browserName: "firefox" },
    },
    {
      name: "webkit",
      use: { ...base.use, channel: undefined, browserName: "webkit" },
    },
  ],
});
