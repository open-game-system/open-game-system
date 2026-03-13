import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  splitting: false,
  sourcemap: true,
  clean: false,
  target: 'node18',
  platform: 'node',
  treeshake: true,
  dts: false,
  external: [
    '@open-game-system/stream-kit-types',
    'puppeteer',
    'puppeteer-stream',
    'peerjs',
    'events',
    'http'
  ],
  noExternal: ['fast-json-patch']
}); 