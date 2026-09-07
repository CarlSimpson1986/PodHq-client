import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import path from "path";

// Separate config from vitest.config.ts on purpose, same reasoning as
// podHq's own vitest.eval.config.ts: evals hit real LLM APIs (cost,
// non-determinism, needs GROQ_API_KEY/ANTHROPIC_API_KEY), so they get
// their own include glob (*.eval.ts, not *.test.ts) and a longer default
// timeout rather than blending into `npm test`.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./src/test/server-only-shim.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["evals/**/*.eval.ts"],
    testTimeout: 90000,
    // Vite deliberately skips .env.local when mode is "test" (its default
    // under vitest) to stop local secrets leaking into test runs by
    // default. Evals are the one deliberate, script-gated exception — same
    // as podHq's own eval config.
    env: loadEnv("development", process.cwd(), ""),
  },
});
