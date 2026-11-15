import { resolve } from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { configDefaults, defineConfig } from "vitest/config"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:4100",
    },
  },
  test: {
    exclude: [...configDefaults.exclude, ".worktrees/**"],
    projects: [
      {
        extends: true,
        test: {
          name: "app",
          include: ["src/**/*.test.{ts,tsx}"],
          environment: "jsdom",
          setupFiles: ["./src/test/setup.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "server",
          include: ["server/**/*.test.ts"],
          environment: "node",
        },
      },
    ],
  },
})
