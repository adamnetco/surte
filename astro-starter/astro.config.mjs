import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import tailwind from "@astrojs/tailwind";

// Astro 5 + Cloudflare Pages (SSR sobre Pages Functions).
// Cada request resuelve su tenant por Host header.
// Docs: https://docs.astro.build/en/guides/integrations-guide/cloudflare/
export default defineConfig({
  output: "server",
  adapter: cloudflare({
    // platformProxy expone bindings (KV, R2, D1, Env) durante `astro dev`
    platformProxy: { enabled: true },
    // "compile" evita Sharp (incompatible con el runtime de Workers)
    imageService: "compile",
  }),
  integrations: [tailwind()],
  vite: {
    ssr: {
      // Cloudflare expone polyfills Node con el flag `nodejs_compat`
      external: ["node:buffer", "node:crypto", "node:stream"],
    },
  },
});
