import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

// Separate from vite.config.ts on purpose: vitest doesn't need the Vue
// plugin (these are plain .ts unit tests, no .vue components under test
// yet) and keeping it standalone avoids pulling jsdom/plugin overhead into
// every `npm run dev` and `npm run build`.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
