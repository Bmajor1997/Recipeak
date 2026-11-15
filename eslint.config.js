// Backend and repository scripts. The mobile app has its own config in apps/mobile.
const nodeGlobals = {
  console: "readonly", process: "readonly", Buffer: "readonly", URL: "readonly", fetch: "readonly",
  AbortController: "readonly", setTimeout: "readonly", clearTimeout: "readonly", setInterval: "readonly", clearInterval: "readonly",
};

export default [
  { ignores: ["node_modules/**", "apps/mobile/**", "coverage/**"] },
  {
    files: ["**/*.js"],
    languageOptions: { ecmaVersion: "latest", sourceType: "module", globals: nodeGlobals },
    rules: {
      "no-undef": "error",
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-unreachable": "error",
      "no-dupe-keys": "error",
      "no-constant-binary-expression": "error",
      "no-control-regex": "off",
      eqeqeq: ["error", "smart"],
    },
  },
  {
    // The private feedback dashboard runs in a browser.
    files: ["admin/**/*.js"],
    languageOptions: {
      globals: {
        document: "readonly", window: "readonly", fetch: "readonly", AbortSignal: "readonly", setTimeout: "readonly",
        clearTimeout: "readonly", encodeURIComponent: "readonly", console: "readonly",
      },
    },
  },
  {
    files: ["**/*.cjs"],
    languageOptions: { ecmaVersion: "latest", sourceType: "commonjs", globals: { ...nodeGlobals, require: "readonly", module: "writable", __dirname: "readonly" } },
  },
];
