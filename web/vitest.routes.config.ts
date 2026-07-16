import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["tests/routes/**/*.test.ts"],
    restoreMocks: true,
    clearMocks: true,
  },
});
