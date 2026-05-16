module.exports = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/tests/**/*.spec.ts", "<rootDir>/tests/**/*.test.ts"],
  modulePathIgnorePatterns: [
    "<rootDir>/.claude/",
    "<rootDir>/.agents/",
    "<rootDir>/node_modules/",
  ],
  watchPathIgnorePatterns: [
    "<rootDir>/.claude/",
    "<rootDir>/.agents/",
    "<rootDir>/node_modules/",
  ],
};
