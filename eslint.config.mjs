import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // android/** and ios/** are Capacitor's generated native projects —
  // their build output (native-bridge.js et al.) isn't app source.
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "android/**", "ios/**"]),
]);

export default eslintConfig;
