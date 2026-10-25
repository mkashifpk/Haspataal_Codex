import { defineConfig } from "vite";
export default defineConfig(({ mode }) => ({
  base: "./",
  define: { __BUILD_IS_DEV__: JSON.stringify(mode === "development") },
  build: { outDir: "dist" },
}));
