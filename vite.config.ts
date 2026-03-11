import { defineConfig } from 'vite';

export default defineConfig({
  // './' keeps asset paths relative — required for GitHub Pages subdirectory hosting
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
});
