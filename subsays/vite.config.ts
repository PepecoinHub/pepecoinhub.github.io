import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src/client',
  base: './',
  build: {
    outDir: '../../dist/client',
    emptyOutDir: true,
    sourcemap: false,
    target: 'es2022',
  },
});
