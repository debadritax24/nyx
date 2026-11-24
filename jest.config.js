module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@noble/.*))',
  ],
  moduleDirectories: ['node_modules', '<rootDir>/node_modules/expo/node_modules'],
  moduleNameMapper: {
    '^@noble/hashes/(.*?)(\\.js)?$': '<rootDir>/node_modules/@noble/hashes/$1.js',
  },
  testMatch: ['**/tests/**/*.test.[jt]s?(x)'],
  testPathIgnorePatterns: ['/node_modules/', 'rls.test.js', 'live_integration.test.js'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
};
