import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Ban `any` outright. It silently sneaks type-unsafety past a passing build
      // (e.g. an untyped `let x = null`). Catch it at lint time, not review time.
      "@typescript-eslint/no-explicit-any": "error",
      // Fail the build on dead code; args prefixed with `_` are intentionally unused.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Enforce `import type { ... }` so type-only imports never end up in a
      // client bundle as a runtime dependency.
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { fixStyle: "separate-type-imports" },
      ],
      // No stray console.log in shipped code; warn/error are fine for diagnostics.
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
