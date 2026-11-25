import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "signtutor/src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./signtutor/vitest.setup.ts"],
    include: ["__tests__/**/*.test.ts", "__tests__/**/*.test.tsx"],
    globals: true,
    testTimeout: 30000,
    hookTimeout: 10000,
  },
});