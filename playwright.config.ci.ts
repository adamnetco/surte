import { defineConfig, devices } from "@playwright/test";

/**
 * CI-only Playwright config.
 *
 * Self-contained (no dependency on lovable-agent-playwright-config) so el
 * pipeline puede correr en GitHub Actions sin el paquete privado.
 * Levanta `vite preview` y corre los specs de /e2e contra ese servidor.
 *
 * Artefactos en fallo: video, trace y screenshot quedan en
 * `playwright-report/` y `test-results/` y se publican como artifacts.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html", { open: "never" }], ["list"]],
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],

  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm run build && npm run preview -- --port 4173 --strictPort",
        url: "http://127.0.0.1:4173",
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
