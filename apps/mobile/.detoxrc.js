/** @type {import('detox').DetoxConfig} */
module.exports = {
  logger: {
    level: process.env.CI ? "debug" : "info",
  },
  testRunner: {
    args: {
      config: "e2e/jest.config.js",
      maxWorkers: 1,
      _: ["e2e"],
    },
    jest: {
      setupTimeout: 120000,
    },
  },
  apps: {
    "ios.release": {
      type: "ios.app",
      // DETOX_IOS_BINARY: a Release .app built elsewhere (each agent its own derived data).
      binaryPath:
        process.env.DETOX_IOS_BINARY ??
        "ios/build/Build/Products/Release-iphonesimulator/opengameapp.app",
      build:
        "xcodebuild -workspace ios/opengameapp.xcworkspace -scheme opengameapp -configuration Release -sdk iphonesimulator -derivedDataPath ios/build -quiet",
    },
    "ios.debug": {
      type: "ios.app",
      binaryPath: "ios/build/Build/Products/Debug-iphonesimulator/opengameapp.app",
      build:
        "xcodebuild -workspace ios/opengameapp.xcworkspace -scheme opengameapp -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build -quiet",
    },
  },
  devices: {
    simulator: {
      type: "ios.simulator",
      // DETOX_SIM_NAME: run on a named simulator of your own (never someone else's).
      device: process.env.DETOX_SIM_NAME
        ? { name: process.env.DETOX_SIM_NAME }
        : { type: "iPhone 16" },
    },
  },
  configurations: {
    "ios.sim.release": {
      device: "simulator",
      app: "ios.release",
    },
    "ios.sim.debug": {
      device: "simulator",
      app: "ios.debug",
    },
  },
};
