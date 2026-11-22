import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  testMatch: ['<rootDir>/src/**/__tests__/**/*.spec.{ts,tsx}'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^react$': require.resolve('react'),
    '^react/jsx-runtime$': require.resolve('react/jsx-runtime'),
    '^react/jsx-dev-runtime$': require.resolve('react/jsx-dev-runtime'),
    '^react-native$': '<rootDir>/src/test-utils/react-native.mock.ts',
    '^@expo/vector-icons$': '<rootDir>/src/test-utils/expo.mock.ts',
    '^react-native-safe-area-context$': '<rootDir>/src/test-utils/expo.mock.ts',
    '^expo-secure-store$': '<rootDir>/src/test-utils/expo.mock.ts',
    '^expo-image-picker$': '<rootDir>/src/test-utils/expo.mock.ts',
    '^expo-application$': '<rootDir>/src/test-utils/expo.mock.ts',
    '^expo-constants$': '<rootDir>/src/test-utils/expo.mock.ts',
    '^expo-file-system(.*)$': '<rootDir>/src/test-utils/expo.mock.ts',
    '^expo-intent-launcher$': '<rootDir>/src/test-utils/expo.mock.ts',
    '^expo-haptics$': '<rootDir>/src/test-utils/expo.mock.ts',
    '^expo-text-extractor$': '<rootDir>/src/test-utils/expo.mock.ts',
    '^@react-native-community/netinfo$': '<rootDir>/src/test-utils/expo.mock.ts',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.jest.json',
      },
    ],
  },
  coveragePathIgnorePatterns: ['/node_modules/', '/.expo/', '/android/'],
};

export default config;
