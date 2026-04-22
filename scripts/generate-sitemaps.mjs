// Pre-build script: generate static sitemap-*.xml files in public/.
// Runs at build time so crawlers hit /sitemap-index.xml directly.
//
// Reads from the same Supabase project as the live app via REST + anon key.

import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, "..", "public");
const BASE = "https://surteya.com";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://dimyhjzcwlgfczimqhet.supabase.co";
const SUPABASE_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpbXloanpjd2xnZmN6aW1xaGV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxODk1OTcsImV4cCI6MjA4OTc2NTU5N30.L2ERMQCCHYuJ51lhVffJaKIXKaVbwF0uGvkf-HxS6BI";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

const CITIES = ["bucaramanga", "floridablanca", "giron", "piedecuesta"];
const STATIC_PAGES = [
  { path: "/", priority: "1.0", change: "daily" },
  { path: "/catalogo", priority: "0.9", change: "daily" },
  { path: "/categorias", priority: "0.8", change: "weekly" },
  { path: "/ofertas", priority: "0.9", change: "daily" },
  { path: "/ayuda", priority: "0.6", change: "monthly" },
  { path: "/enlaces", priority: "0.7", change: "weekly" },
  { path: "/login", priority: "0.4", change: "yearly" },
  { path: "/politicas", priority: "0.3", change: "yearly" },
  { path: "/tratamiento-datos", priority: "0.3", change: "yearly" },
];

const xmlEsc = (s) => String(s).replace(/[<>&"']/g, (c) => ({ "<":"&lt;",">":"&gt;","&":"&amp;","\"":"&quot;","'":"&apos;" }[c]));
const today = new Date().toISOString().split("T")[0];

const urlEntry = (loc, lastmod = today, change = "weekly", priority = "0.7") => `  <url>
    <loc>${xmlEsc(loc)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${change}</changefreq>
    <priority>${priority}</priority>
  </url>`;

const wrapUrlset = (entries) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${entries.join("\n")}
</urlset>`;

const writeFile = (name, content) => {
  mkdirSync(PUBLIC_DIR, { recursive: true });
  writeFileSync(join(PUBLIC_DIR, name), content, "utf-8");
  console.log(`  ✓ ${name} (${(content.length / 1024).toFixed(1)} kB)`);
};

async function main() {
  console.log("→ Generating static sitemaps in public/");

  // Static
  writeFile(
    "sitemap-pages.xml",
    wrapUrlset(STATIC_PAGES.map((p) => urlEntry(`${BASE}${p.path}`, today, p.change, p.priority)))
  );

  // Categories (+ city variants)
  const { data: cats = [] } = await supabase.from("categories").select("slug, name, updated_at").eq("is_active", true);
  const catEntries = [];
  for (const c of cats) {
    const lm = (c.updated_at || "").split("T")[0] || today;
    catEntries.push(urlEntry(`${BASE}/hub/categoria/${c.slug}`, lm, "weekly", "0.8"));
    for (const city of CITIES) {
      catEntries.push(urlEntry(`${BASE}/${city}/categoria/${c.slug}`, lm, "weekly", "0.85"));
    }
  }
  writeFile("sitemap-categories.xml", wrapUrlset(catEntries));

  // Brands (+ city variants)
  const { data: brands = [] } = await supabase.from("brands").select("slug, name").eq("is_active", true);
  const brandEntries = [];
  for (const b of brands) {
    const slug = b.slug || (b.name || "").toLowerCase().replace(/\s+/g, "-");
    brandEntries.push(urlEntry(`${BASE}/hub/marca/${slug}`, today, "weekly", "0.7"));
    for (const city of CITIES) {
      brandEntries.push(urlEntry(`${BASE}/${city}/marca/${slug}`, today, "weekly", "0.75"));
    }
  }
  writeFile("sitemap-brands.xml", wrapUrlset(brandEntries));

  // Cities
  const { data: munis = [] } = await supabase.from("municipality_settings").select("city, slug, updated_at").eq("is_active", true);
  const cityEntries = munis.map((m) => {
    const slug = (m.slug || m.city || "").toLowerCase();
    const lm = (m.updated_at || "").split("T")[0] || today;
    return urlEntry(`${BASE}/${slug}`, lm, "weekly", "0.85");
  });
  writeFile("sitemap-cities.xml", wrapUrlset(cityEntries));

  // Products (paginate to be safe — 1000-row limit)
  const productEntries = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data: prods = [], error } = await supabase
      .from("products")
      .select("id, slug, updated_at, image_url, name")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!prods.length) break;
    for (const p of prods) {
      const slug = p.slug || p.id;
      const lm = (p.updated_at || "").split("T")[0] || today;
      const img = p.image_url
        ? `\n    <image:image><image:loc>${xmlEsc(p.image_url)}</image:loc><image:title>${xmlEsc(p.name || "")}</image:title></image:image>`
        : "";
      productEntries.push(`  <url>
    <loc>${BASE}/producto/${slug}</loc>
    <lastmod>${lm}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>${img}
  </url>`);
    }
    if (prods.length < pageSize) break;
    from += pageSize;
  }
  writeFile("sitemap-products.xml", wrapUrlset(productEntries));

  // Landing pages (SEO Pages)
  const { data: landings = [] } = await supabase
    .from("landing_pages")
    .select("slug, updated_at")
    .eq("is_active", true);
  const landingEntries = landings.map((l) =>
    urlEntry(`${BASE}/s/${l.slug}`, (l.updated_at || "").split("T")[0] || today, "monthly", "0.6")
  );
  writeFile("sitemap-landing.xml", wrapUrlset(landingEntries));

  // Index
  const idxEntries = [
    "sitemap-pages.xml",
    "sitemap-categories.xml",
    "sitemap-brands.xml",
    "sitemap-cities.xml",
    "sitemap-products.xml",
    "sitemap-landing.xml",
  ].map((f) => `  <sitemap><loc>${BASE}/${f}</loc><lastmod>${today}</lastmod></sitemap>`);
  writeFile(
    "sitemap-index.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${idxEntries.join("\n")}
</sitemapindex>`
  );

  // Backwards-compatible alias
  writeFile(
    "sitemap.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${idxEntries.join("\n")}
</sitemapindex>`
  );

  console.log("✓ Sitemaps generated");
}

main().catch((e) => {
  console.error("✗ Sitemap generation failed:", e);
  process.exit(1);
});
