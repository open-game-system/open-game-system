import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: false, // Disabled: React 19 types from monorepo root conflict with RN's React 18 types. Fix by pinning @types/react resolution.
  splitting: false,
  sourcemap: true,
  clean: true,
  external: [
    '@open-game-system/app-bridge-types',
    '@open-game-system/app-bridge-native',
    'react',
    'react-native',
    'react-native-webview'
  ]
}); 