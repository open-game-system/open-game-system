/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  maxWorkers: 1,
  globalSetup: "detox/runners/jest/globalSetup",
  globalTeardown: "detox/runners/jest/globalTeardown",
  testEnvironment: "detox/runners/jest/testEnvironment",
  setupFilesAfterEnv: ["<rootDir>/e2e/setup.ts"],
  testRunner: "jest-circus/runner",
  testTimeout: 120000,
  testMatch: ["<rootDir>/e2e/**/*.test.ts"],
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "<rootDir>/e2e/tsconfig.json" }],
  },
  reporters: ["detox/runners/jest/reporter"],
  verbose: true,
  rootDir: "..",
};
