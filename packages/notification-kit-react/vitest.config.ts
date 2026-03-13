import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    deps: {
      inline: ['@open-game-system/app-bridge', 'fast-json-patch'],
      optimizer: {
        web: {
          include: ['@open-game-system/app-bridge', 'fast-json-patch']
        }
      }
    }
  },
});
