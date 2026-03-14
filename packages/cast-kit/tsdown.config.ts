import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/client/index.ts',
    'src/react/index.ts',
    'src/mock/index.ts',
    'src/receiver/index.ts',
  ],
  format: ['cjs', 'esm'],
  dts: true,
});
