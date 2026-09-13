import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

/** Flat config: Next.js recommended rules plus the project's ignores. */
const config = [
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      // Server Actions receive (previousState, formData) whether or not a given
      // action needs them; a leading underscore marks those as deliberate.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    ignores: [
      "src/generated/**",
      ".next/**",
      "node_modules/**",
      "prisma/migrations/**",
    ],
  },
];

export default config;
