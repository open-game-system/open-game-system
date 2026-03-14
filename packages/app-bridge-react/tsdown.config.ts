import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.tsx'],
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  deps: {
    neverBundle: [
      '@open-game-system/app-bridge-types',
      '@open-game-system/app-bridge-web',
      'react'
    ],
  }
}); 