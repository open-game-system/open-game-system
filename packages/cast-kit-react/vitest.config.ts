import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
  },
  resolve: {
    alias: {
      '@open-game-system/cast-kit-core': path.resolve(__dirname, '../cast-kit-core/src/index.ts'),
      '@open-game-system/app-bridge-react': path.resolve(__dirname, '../app-bridge-react/src/index.tsx'),
      '@open-game-system/app-bridge-web': path.resolve(__dirname, '../app-bridge-web/src/index.ts'),
      '@open-game-system/app-bridge-types': path.resolve(__dirname, '../app-bridge-types/src/index.ts'),
    },
  },
});
