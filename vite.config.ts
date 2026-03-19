import { defineConfig } from 'vite';

export default defineConfig({
  // './' keeps asset paths relative — required for GitHub Pages subdirectory hosting
  //base: './',
  base:'/rifle-simulator-ts/',
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
});
