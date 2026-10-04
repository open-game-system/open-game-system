/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  plugins: ["@stryker-mutator/jest-runner", "@stryker-mutator/typescript-checker"],
  packageManager: "pnpm",
  reporters: ["html", "json", "clear-text", "progress"],
  jsonReporter: { fileName: "reports/mutation/mutation.json" },
  incrementalFile: "reports/stryker-incremental.json",
  testRunner: "jest",
  jest: {
    configFile: "package.json",
  },
  coverageAnalysis: "perTest",
  mutate: [
    "services/**/*.ts",
    "!services/**/*.test.ts",
    "!services/**/__tests__/**",
    // In flux on design/ogs-app-hillclimb: mutate once they settle.
    "!services/runtime.ts",
    "!services/app-state.ts",
    "!services/playing-home.ts",
    "!services/friends*.ts",
    "!services/ogs-api.ts",
    "!services/identity.ts",
  ],
  ignorePatterns: ["ios", "android", "node_modules", ".expo", "dist", "assets"],
  thresholds: {
    high: 90,
    low: 70,
    break: 60,
  },
  htmlReporter: {
    fileName: "reports/mutation/index.html",
  },
  tempDirName: ".stryker-tmp",
  warnings: {
    unknownOptions: false,
  },
};
