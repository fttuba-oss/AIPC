import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { knowledgeApiMiddleware } from './src/backend/server/apiMiddleware';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'aipc-backend-api',
      configureServer(server) {
        server.middlewares.use(knowledgeApiMiddleware());
      },
    },
  ],
  server: {
    port: 5174
  }
});
