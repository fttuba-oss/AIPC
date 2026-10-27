import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { knowledgeApiMiddleware } from './src/legacy/backend/server/apiMiddleware';
import { storageApiMiddleware } from './src/legacy/backend/server/storageApiMiddleware';
import path from 'node:path';
import { scoreApiMiddleware } from './src/modules/score/server';
import { practiceApiMiddleware } from './src/modules/practice/server';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'aipc-backend-api',
      configureServer(server) {
        const storageRoot = process.env.AIPC_STORAGE_ROOT;
        server.middlewares.use(scoreApiMiddleware({ storageRoot }));
        server.middlewares.use(practiceApiMiddleware({ storageRoot }));
        server.middlewares.use(storageApiMiddleware());
        server.middlewares.use(knowledgeApiMiddleware());
      },
    },
  ],
  server: {
    port: 5174,
    watch: {
      ignored: ['**/Score Following/**'],
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        teacher: path.resolve(__dirname, 'teacher.html'),
        student: path.resolve(__dirname, 'student.html'),
      },
    },
  },
});
