import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import tailwind from "@astrojs/tailwind";

// SSR sobre Cloudflare Pages Functions.
// Cada request resuelve su tenant por Host header.
export default defineConfig({
  output: "server",
  adapter: cloudflare({
    platformProxy: { enabled: true },
    imageService: "compile",
  }),
  integrations: [tailwind()],
  vite: {
    ssr: {
      // Supabase y otros paquetes que dependen de APIs Node se externalizan
      // y usan los polyfills de Cloudflare (nodejs_compat flag en wrangler.toml).
      external: ["node:buffer", "node:crypto", "node:stream"],
    },
  },
});
