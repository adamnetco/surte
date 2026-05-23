import { defineConfig } from "astro/config";
import vercel from "@astrojs/vercel/serverless";
import tailwind from "@astrojs/tailwind";

// SSR para que cada request resuelva su tenant por Host header.
export default defineConfig({
  output: "server",
  adapter: vercel({ webAnalytics: { enabled: true }, isr: { expiration: 60 * 10 } }),
  integrations: [tailwind()],
});
