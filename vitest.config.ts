// Separate from vite.config.ts so tests do not load the IWSDK dev plugin.
// Tests cover pure game logic only (see docs/mvp.md, Tests).
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['src/**/*.test.ts'] },
});
