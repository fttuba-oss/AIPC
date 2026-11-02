import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { knowledgeApiMiddleware } from './src/backend/server/apiMiddleware';
import { storageApiMiddleware } from './src/backend/server/storageApiMiddleware';
import path from 'node:path';

// https://vite.dev/config/
export default defineConfig({
  base: process.env.AIPC_STUDENT_TRIAL === 'true' ? './' : '/',
  publicDir: process.env.AIPC_STUDENT_TRIAL === 'true' ? false : 'public',
  define: {
    'import.meta.env.VITE_STUDENT_TRIAL': JSON.stringify(process.env.AIPC_STUDENT_TRIAL === 'true' ? 'true' : 'false'),
  },
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'aipc-backend-api',
      configureServer(server) {
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
      input: process.env.AIPC_STUDENT_TRIAL === 'true' ? {
        student: path.resolve(__dirname, 'student.html'),
      } : {
        main: path.resolve(__dirname, 'index.html'),
        student: path.resolve(__dirname, 'student.html'),
      },
    },
  },
});
