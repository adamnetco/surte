import { test, expect } from "../playwright-fixture";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

/**
 * E2E — SurteYa funciona como tenant autónomo (Etapa 39.c).
 *
 * Objetivo: asegurar que SurteYa NO está hardcodeado en el código y que su
 * storefront/login/admin se sirven puramente vía el resolver de tenant
 * (`tenant_domains.hostname → organization_id`).
 *
 * Estrategia:
 *  - Si existe `PLAYWRIGHT_TENANT_BASE_URL` (ej. https://surteya.sistecpos.com)
 *    corremos los smoke tests reales contra ese host.
 *  - Si no, hacemos las verificaciones que SÍ podemos hacer offline contra
 *    `baseURL` (vite preview) + checks estáticos sobre el código fuente.
 *
 * Nota: el audit estático completo vive en `scripts/audit-hardcoding.ts` y
 * en la regla ESLint `no-restricted-syntax`. Aquí solo dejamos las guardas
 * que tienen sentido como E2E.
 */

const TENANT_BASE_URL = process.env.PLAYWRIGHT_TENANT_BASE_URL;

test.describe("SurteYa como tenant autónomo", () => {
  test("storefront del tenant carga sin errores (requiere PLAYWRIGHT_TENANT_BASE_URL)", async ({
    page,
  }) => {
    test.skip(
      !TENANT_BASE_URL,
      "Define PLAYWRIGHT_TENANT_BASE_URL=https://surteya.sistecpos.com para correr este smoke.",
    );

    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto(`${TENANT_BASE_URL}/`);
    await page.waitForLoadState("networkidle");

    expect(errors, `Errores en runtime: ${errors.join("\n")}`).toHaveLength(0);

    // Body no vacío (no pantalla blanca).
    const body = await page.locator("body").innerText();
    expect(body.length).toBeGreaterThan(50);

    // El tenant debe resolverse — el city picker (alimentado por DB) o el
    // header con buscador deben renderizar.
    const hasResolvedTenant =
      (await page.locator("input[type='search'], input[placeholder*='Buscar' i]").count()) > 0 ||
      (await page.getByText(/¿Dónde te encuentras\?/i).count()) > 0;
    expect(hasResolvedTenant, "El resolver de tenant no parece haber pintado nada del shell").toBe(
      true,
    );
  });

  test("/catalogo del tenant renderiza productos", async ({ page }) => {
    test.skip(!TENANT_BASE_URL, "Requiere PLAYWRIGHT_TENANT_BASE_URL.");

    await page.goto(`${TENANT_BASE_URL}/catalogo`);
    await page.waitForLoadState("networkidle");

    const body = await page.locator("body").innerText();
    expect(body.length).toBeGreaterThan(0);
    // Estado "sin productos" o grid renderizado: ambos son válidos, lo que
    // NO es válido es un error 404 / pantalla en blanco.
    expect(body).not.toMatch(/404/i);
  });

  test("/superadmin sigue accesible desde el host raíz", async ({ page }) => {
    // Esto SIEMPRE corre, no depende del tenant.
    await page.goto("/superadmin");
    await page.waitForLoadState("networkidle");
    expect(page.url()).toMatch(/(login|superadmin)/);
  });

  test("baseline anti-regresión: hardcodes legacy no aumentan", () => {
    // Corre el audit script estático (mismo que valida el plan en CI).
    const res = spawnSync("bun", ["run", "scripts/audit-hardcoding.ts"], {
      encoding: "utf8",
    });
    // Exit 0 = igual o por debajo del baseline; 1 = creció.
    expect(
      res.status,
      `audit-hardcoding superó el baseline:\n${res.stdout}\n${res.stderr}`,
    ).toBe(0);
  });

  test("no hay branches de código que comparen slug === 'surteya'", () => {
    // Whitelist explícita: archivos que tienen referencias legítimas
    // (redirects de dominio, tareas superadmin, tests).
    const ALLOWED = [
      /SurteyaRedirect\.tsx$/,
      /legacyDomains\.ts$/,
      /cloudTasks\.ts$/,
      /\.test\.(ts|tsx)$/,
      /\.spec\.(ts|tsx)$/,
      /^supabase\/seeds\//,
      /^docs\//,
      /^\.lovable\//,
      /^scripts\/audit-hardcoding\.ts$/,
      /^eslint\.config\.js$/,
      /^astro-starter\//,
    ];

    const res = spawnSync(
      "rg",
      [
        "-l",
        "--no-ignore-vcs",
        "-g",
        "!node_modules",
        "-g",
        "!dist",
        "-g",
        "!.git",
        String.raw`['"\`]surteya['"\`]`,
        ".",
      ],
      { encoding: "utf8" },
    );

    const hits = (res.stdout || "")
      .split("\n")
      .map((s) => s.replace(/^\.\//, "").trim())
      .filter(Boolean)
      .filter((f) => !ALLOWED.some((re) => re.test(f)));

    expect(
      hits,
      `Archivos con literal "surteya" fuera de la whitelist:\n${hits.join("\n")}`,
    ).toEqual([]);
  });

  test("seed_surteya_org.sql sigue existiendo y es idempotente", () => {
    const sql = readFileSync("supabase/seeds/seed_surteya_org.sql", "utf8");
    expect(sql).toContain("ON CONFLICT (slug) DO UPDATE");
    expect(sql).toContain("ON CONFLICT (hostname) DO UPDATE");
    expect(sql).toContain("ON CONFLICT (organization_id, key)");
    expect(sql).toContain("ON CONFLICT (organization_id, module_key)");
  });
});
