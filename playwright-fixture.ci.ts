/**
 * CI fixture stub — re-exporta el `test`/`expect` estándar de @playwright/test
 * para que los specs de /e2e funcionen sin depender de
 * `lovable-agent-playwright-config` en GitHub Actions.
 *
 * El sandbox de Lovable sigue usando `playwright-fixture.ts` (raíz) que
 * importa el fixture real del agente.
 */
export { test, expect } from "@playwright/test";
