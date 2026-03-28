/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  plugins: ["@stryker-mutator/jest-runner", "@stryker-mutator/typescript-checker"],
  packageManager: "pnpm",
  reporters: ["html", "clear-text", "progress"],
  testRunner: "jest",
  jest: {
    configFile: "package.json",
  },
  coverageAnalysis: "perTest",
  mutate: ["services/**/*.ts", "!services/**/*.test.ts", "!services/**/__tests__/**"],
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
