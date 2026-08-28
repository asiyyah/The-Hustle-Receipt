import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      "server-only": fileURLToPath(
        new URL("./tests/support/server-only.ts", import.meta.url)
      ),
    },
  },
  test: {
    environment: "node",
    clearMocks: true,
    restoreMocks: true,
  },
})
