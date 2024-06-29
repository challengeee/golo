/// <reference types="vitest" />
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  build: {
    outDir: 'dist',
    lib: {
      entry: 'src/index.ts',
      name: 'golo',
      fileName: 'index',
      formats: ['es', 'umd'],
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
  plugins: [dts()],
})
