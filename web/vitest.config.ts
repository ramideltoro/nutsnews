import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/component/setup.ts"],
    include: ["tests/component/**/*.test.{ts,tsx}"],
    restoreMocks: true,
    clearMocks: true,
    css: false,
  },
});
