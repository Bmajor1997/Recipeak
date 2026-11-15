// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

// Names that a library or React itself decides, so they keep their own case.
const REQUIRED_NAMES = [
  "^use[A-Z]", // React hooks: React's hook checks only recognise names that start with "use" and a capital
  "^on[A-Z]", // React and React Native event props (onPress, onChange, onPanResponderMove…)
  "^tabBar[A-Z]", // Expo Router tab options
  "^(getItem|setItem|removeItem)$", // AsyncStorage's storage interface
  "^(getReactNativePersistence|toJSON|findAllByType|findByProps)$", // Firebase and react-test-renderer APIs
].join("|");

module.exports = defineConfig([
  expoConfig,
  { ignores: ["dist/*", ".expo/*", "android/*", "ios/*"] },
  {
    // House rule: every function and method we name is snake_case. React components are PascalCase, and names
    // fixed by React or a library (REQUIRED_NAMES above) keep their own case.
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: require("node:path").dirname(require.resolve("./tsconfig.json")) },
    },
    rules: {
      "@typescript-eslint/naming-convention": [
        "error",
        { selector: "default", format: null },
        {
          selector: ["function", "variable", "method", "typeMethod", "objectLiteralMethod"],
          filter: { regex: REQUIRED_NAMES, match: true },
          format: null,
        },
        // Destructured names come from somewhere else (useState setters, a context, a hook's result).
        { selector: "variable", modifiers: ["destructured"], format: null },
        { selector: "function", format: ["snake_case", "PascalCase"] },
        { selector: "variable", types: ["function"], format: ["snake_case", "PascalCase"] },
        { selector: ["classMethod", "typeMethod"], format: ["snake_case"] },
        // PascalCase here is a component handed over as a value (for example a mocked React Native component).
        { selector: "objectLiteralMethod", format: ["snake_case", "PascalCase"] },
      ],
    },
  },
]);
