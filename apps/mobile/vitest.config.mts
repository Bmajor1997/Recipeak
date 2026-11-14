import { defineConfig } from "vitest/config";

// Pure logic only (parsing, formatting, saved recipes, the API client). Screens are checked by the type-checker and on a device.
export default defineConfig({ test: { include: ["tests/**/*.test.ts"], environment: "node" } });
