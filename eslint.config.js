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
      "@typescript-eslint/no-unused-vars": "off",
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
      ],
    },
  },
);
