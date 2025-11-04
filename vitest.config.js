// vitest.config.mjs
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.spec.{js,ts}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: './coverage',
      include: ['apps/api/**/*.js'],
      exclude: [
        'apps/api/server.js',       
        'apps/api/routes/ui.js',    
        'apps/api/start.js',
        'apps/api/utils/errors.js',
        'apps/web/**',
        'docs/**',
        '**/node_modules/**'
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        statements: 80,
        branches: 80                
      }
    }
  }
})
