import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// One HTML entry per page
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        home: resolve(__dirname, 'index.html'),
        notFound: resolve(__dirname, '404.html'),
        books: resolve(__dirname, 'books/index.html'),
        running: resolve(__dirname, 'running/index.html'),
        photography: resolve(__dirname, 'photography/index.html'),
        experience: resolve(__dirname, 'experience/index.html'),
        'exp-z21': resolve(__dirname, 'experience/z21/index.html'),
        'exp-nri': resolve(__dirname, 'experience/nri/index.html'),
        'exp-iit-delhi': resolve(__dirname, 'experience/iit-delhi/index.html'),
        'exp-st-johns': resolve(__dirname, 'experience/st-johns/index.html'),
        'games-mrwhite': resolve(__dirname, 'Games/mrwhite/index.html'),
      },
    },
  },
});
