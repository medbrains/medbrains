/**
 * Detox's Jest runner. Separate from the app's vitest suite on purpose: that
 * one is pure logic and runs in milliseconds on every save, this one boots a
 * simulator and is run deliberately.
 */
module.exports = {
  rootDir: "..",
  testMatch: ["<rootDir>/e2e/**/*.e2e.ts"],
  testTimeout: 180000,
  maxWorkers: 1,
  globalSetup: "detox/runners/jest/globalSetup",
  globalTeardown: "detox/runners/jest/globalTeardown",
  reporters: ["detox/runners/jest/reporter"],
  testEnvironment: "detox/runners/jest/testEnvironment",
  transform: {
    "\\.[jt]sx?$": ["ts-jest", { tsconfig: "e2e/tsconfig.json" }],
  },
  verbose: true,
};
