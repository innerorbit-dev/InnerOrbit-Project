module.exports = {
    testEnvironment: 'node',
    setupFiles: [
        '<rootDir>/jest.setup.js'
    ],
    transform: {
        '^.+\\.[jt]sx?$': 'babel-jest'
    },
    transformIgnorePatterns: [
        'node_modules/(?!(react-native|@react-native|expo|@expo|@unimodules|unimodules|react-clone-referenced-element|@react-native-community|expo-asset|expo-constants|expo-file-system|expo-font|expo-keep-awake|expo-linear-gradient|expo-linking|expo-location|expo-permissions|expo-splash-screen|expo-status-bar|expo-updates|expo-web-browser|zustand|@noble)/)'
    ],
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
    testMatch: [
        '**/__tests__/**/*.test.[jt]s?(x)',
        '**/?(*.)+(spec|test).[jt]s?(x)'
    ],
    collectCoverageFrom: [
        'lib/**/*.[jt]s?(x)',
        'components/**/*.[jt]s?(x)',
        'app/**/*.[jt]s?(x)',
        '!**/__tests__/**',
        '!**/__mocks__/**',
        '!**/node_modules/**',
        '!**/coverage/**'
    ],
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
        '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/__mocks__/fileMock.js'
    }
};
