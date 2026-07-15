const { getDefaultConfig } = require('@expo/metro-config');
const { mergeConfig } = require('@react-native/metro-config');
const path = require('path');

const expoConfig = getDefaultConfig(__dirname);

const firebaseRnMap = {
  // CJS build — single @firebase/app module instance
  'firebase/app': path.resolve(
    __dirname,
    'node_modules/@firebase/app/dist/index.cjs.js'
  ),
  // RN-specific build — calls registerAuth('ReactNative') for AsyncStorage persistence
  'firebase/auth': path.resolve(
    __dirname,
    'node_modules/firebase/node_modules/@firebase/auth/dist/rn/index.js'
  ),
  // CJS build — uses require('@firebase/app') so same singleton as above
  'firebase/database': path.resolve(
    __dirname,
    'node_modules/@firebase/database/dist/index.cjs.js'
  ),
};

const cjsWebMap = {
  'zustand': path.resolve(__dirname, 'node_modules/zustand/index.js'),
  'zustand/vanilla': path.resolve(__dirname, 'node_modules/zustand/vanilla.js'),
};

module.exports = mergeConfig(expoConfig, {
  resolver: {
    resolveRequest: (context, moduleName, platform) => {
      if (cjsWebMap[moduleName]) {
        return {
          filePath: cjsWebMap[moduleName],
          type: 'sourceFile',
        };
      }
      if (platform === 'android' || platform === 'ios') {
        if (firebaseRnMap[moduleName]) {
          return {
            filePath: firebaseRnMap[moduleName],
            type: 'sourceFile',
          };
        }
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
});