import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      // Fase 1 del refactor: el POS legacy en `softwarepos.online` quedó
      // deprecado. Cualquier nuevo literal con ese dominio en el código
      // (no en comentarios) re-introduce el bug del redirect externo.
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/softwarepos\\.online/]",
          message:
            "softwarepos.online quedó deprecado en la Fase 1. Usa la ruta /pos nativa.",
        },
        {
          selector: "TemplateElement[value.raw=/softwarepos\\.online/]",
          message:
            "softwarepos.online quedó deprecado en la Fase 1. Usa la ruta /pos nativa.",
        },
        // Etapa 40 — anti-regresión tenant-hardcode. El core no debe contener
        // literales atados a un tenant específico. Tenants se configuran vía
        // `organizations`, `tenant_domains` y `app_settings`.
        {
          selector:
            "Literal[value=/\\b(SurteYa|surteya|Bucaramanga|Santander|C[áa]rnicos|Pulpas|Panificados)\\b/]",
          message:
            "Etapa 40: no introduzcas literales atados a un tenant. Léelos de `organizations`/`app_settings`.",
        },
        {
          selector:
            "TemplateElement[value.raw=/\\b(SurteYa|surteya|Bucaramanga|Santander|C[áa]rnicos|Pulpas|Panificados)\\b/]",
          message:
            "Etapa 40: no introduzcas literales atados a un tenant en template strings.",
        },
      ],
    },
  },
  // Excepciones explícitas (legacy adapters, superadmin tasks, tests, scaffolds Lovable):
  {
    files: [
      "src/components/SurteyaRedirect.tsx",
      "src/modules/tenant/lib/legacyDomains.ts",
      "src/modules/superadmin/lib/cloudTasks.ts",
      "**/*.test.ts",
      "**/*.test.tsx",
    ],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
);
