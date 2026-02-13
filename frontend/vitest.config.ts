import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    alias: {
      'recharts': path.resolve(__dirname, './src/__mocks__/recharts.tsx'),
      'react-window': path.resolve(__dirname, './src/__mocks__/react-window.tsx'),
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html', 'json', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.d.ts',
        'src/__mocks__/**',
        'src/test-setup.ts',
        'src/app/**',
        'src/components/ui/**',
      ],
      thresholds: {
        statements: 85,
        branches: 85,
        functions: 85,
        lines: 85,
        'src/components/**': {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90,
        },
        'src/hooks/**': {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90,
        },
        'src/lib/**': {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
