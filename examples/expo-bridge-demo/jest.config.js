module.exports = {
  preset: "jest-expo",
  transformIgnorePatterns: [
    "node_modules/(?!(.pnpm|((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|@open-game-system/.*))",
  ],
  moduleNameMapper: {
    "^@open-game-system/(.*)$": "<rootDir>/../../packages/$1/src",
  },
};
