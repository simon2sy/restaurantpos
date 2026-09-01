module.exports = {
  // Use haste config for RN 0.76 platform-specific file resolution
  haste: {
    defaultPlatform: 'android',
    platforms: ['android', 'ios', 'native'],
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|react-native-reanimated|react-native-gesture-handler|react-native-screens|react-native-safe-area-context|@react-native-community/netinfo|@expo/vector-icons|expo-font|expo-secure-store|expo-splash-screen|expo-camera|expo-image-picker|expo-linear-gradient|expo-device|expo-notifications)',
  ],
  setupFiles: [
    'react-native/jest/setup',
    '<rootDir>/jest.setup.js',
  ],
  moduleFileExtensions: ['android.js', 'ios.js', 'native.js', 'ts', 'tsx', 'js', 'jsx', 'json'],
  testMatch: ['**/__tests__/**/*.test.js', '**/?(*.)+(spec|test).js'],
  moduleNameMapper: {
    '\\.(css|less)$': '<rootDir>/__mocks__/styleMock.js',
  },
  globals: {
    __DEV__: true,
  },
};
