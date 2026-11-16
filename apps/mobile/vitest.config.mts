import { defineConfig } from "vitest/config";

// Pure logic only (parsing, formatting, saved recipes, the API client). Screens are checked by the type-checker and on a device.
// Bundled photos (require("…jpg")) only mean something to the app bundler, so tests see each one as a placeholder number.
export default defineConfig({
  plugins: [
    {
      name: "bundled-photos-as-numbers",
      transform(code, id) {
        if (!id.includes("/src/") || !/require\("[^"]+\.(jpg|png)"\)/.test(code)) return null;
        return code.replace(/require\("[^"]+\.(jpg|png)"\)/g, "1");
      },
    },
  ],
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
});
