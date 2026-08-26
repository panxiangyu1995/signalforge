import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: './src/index.ts'
  },
  platform: 'node',
  format: ['esm'],
  sourcemap: true,
  clean: true,
  outDir: './dist',
  treeshake: false,
  deps: {
    neverBundle: ['@signal-forge/core', /^@signal-forge\/core\//, 'canvaskit-wasm', /^node:/],
    onlyBundle: false
  }
})
