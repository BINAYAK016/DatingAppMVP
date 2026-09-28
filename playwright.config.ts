import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/ui",
  timeout: 60000,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:8081",
    viewport: { width: 412, height: 915 },
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL as "chrome" | undefined,
    screenshot: "only-on-failure",
  },
  outputDir: "artifacts/ui",
});
