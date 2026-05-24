import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Build-time sitemap generator. Runs once on `vite build` start.
const sitemapPlugin = () => ({
  name: "surteya-sitemap-generator",
  apply: "build" as const,
  buildStart: () =>
    new Promise<void>((resolve) => {
      const proc = spawn("node", [path.join(__dirname, "scripts", "generate-sitemaps.mjs")], {
        stdio: "inherit",
        env: process.env,
      });
      proc.on("exit", () => resolve()); // never block build on sitemap errors
      proc.on("error", () => resolve());
    }),
});

export default defineConfig(({ mode }) => ({
  server: { host: "::", port: 8080, hmr: { overlay: false } },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    mode !== "development" && sitemapPlugin(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: false, // we register manually with iframe guard
      strategies: "generateSW",
      devOptions: { enabled: false },
      includeAssets: [
        "favicon.png",
        "icons/icon-192.png",
        "icons/icon-512.png",
        "icons/apple-touch-icon.png",
      ],
      workbox: {
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [
          /^\/~oauth/,
          /^\/sitemap.*\.xml$/,
          /^\/robots\.txt$/,
          /^\/api\//,
        ],
        globPatterns: ["**/*.{js,css,html,woff2,svg,png,ico}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.hostname === "storage.googleapis.com" ||
              url.hostname.endsWith(".supabase.co"),
            handler: "StaleWhileRevalidate",
            options: { cacheName: "surte-images", expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 } },
          },
        ],
      },
      manifest: {
        name: "SURTÉ YA — Soluciones Alimenticias",
        short_name: "SURTÉ YA",
        description:
          "Salsas, cárnicos y pulpas al mayor en Bucaramanga, Floridablanca, Girón y Piedecuesta. Domicilios mismo día.",
        theme_color: "#0C4B83",
        background_color: "#0C4B83",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/?utm_source=pwa",
        lang: "es-CO",
        categories: ["food", "shopping", "business"],
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        shortcuts: [
          { name: "Catálogo", short_name: "Catálogo", url: "/catalogo", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
          { name: "Ofertas", short_name: "Ofertas", url: "/ofertas", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
          { name: "Mis pedidos", short_name: "Pedidos", url: "/pedidos", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
}));
