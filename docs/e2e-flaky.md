# Aislamiento de tests flakey

Los tests inestables se marcan con la etiqueta `@flaky` en su título y
quedan **fuera del pipeline de PR**, por lo que ya no pueden bloquear un
merge. Se ejecutan en un job nocturno separado.

## Cómo marcar un test como flakey

Añade `@flaky` en el título del `test(...)` o del `test.describe(...)`:

```ts
test("@flaky cobro con propina genera SaleCompleteDialog", async ({ page }) => {
  // ...
});

// o un grupo entero
test.describe("@flaky impresión de ticket Z", () => { /* ... */ });
```

Opcional: documenta el motivo en un comentario encima (timing, dependencia
externa, race condition conocida) y crea un issue para estabilizarlo.

## Qué corre cada pipeline

| Workflow                        | Trigger                | Qué ejecuta                        | Bloquea merge |
| ------------------------------- | ---------------------- | ---------------------------------- | ------------- |
| `e2e.yml`                       | push / PR              | Todo **excepto** `@flaky`          | Sí            |
| `e2e-flaky-nightly.yml`         | cron 07:00 UTC + manual | **Solo** `@flaky`, con 3 reintentos | No            |

El job nocturno:
- No falla el pipeline principal (el step de Playwright usa `continue-on-error`).
- Sube `playwright-flaky-report` y, si falla, `playwright-flaky-artifacts`
  (traces, videos, screenshots) con 30 días de retención.
- Abre/actualiza un issue con label `flaky-nightly` cuando hay fallos para
  que la inestabilidad quede visible.

## Umbral de tasa de fallos

El step `Enforce flaky threshold` (`scripts/enforce-flaky-threshold.cjs`)
hace **fallar el job nocturno** cuando la inestabilidad supera lo aceptable,
para que el equipo priorice la causa raíz en vez de normalizar la flakiness:

| Variable                    | Default | Qué mide                                              |
| --------------------------- | ------- | ----------------------------------------------------- |
| `FLAKY_FAILURE_THRESHOLD`   | `30`    | % máx. de tests del suite marcados como flakey        |
| `FLAKY_PER_TEST_THRESHOLD`  | `60`    | % máx. de intentos fallidos para un test individual   |

Se ajustan en `env:` de `.github/workflows/e2e-flaky-nightly.yml`. Cuando se
supera alguno, el job marca fallo, se publica el detalle en el Job Summary
y se abre/actualiza el issue `flaky-nightly`.
- Abre/actualiza un issue con label `flaky-nightly` cuando hay fallos para
  que la inestabilidad quede visible.

## Cuando un test se estabiliza

1. Quita `@flaky` del título.
2. Cierra el issue `flaky-nightly` asociado si aplica.
3. El test pasa a correr en el pipeline de PR y ya puede bloquear merge.
