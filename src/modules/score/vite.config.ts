import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
// This workbench intentionally registers no other domain or backend.
export default defineConfig({
 root: process.cwd(),
 plugins: [react(), tailwindcss()],
 optimizeDeps: { entries: [path.resolve('dev-score.html')] },
 server: { port: 5180, strictPort: true },
 build: { outDir: '.aipc-build/score', rollupOptions: { input: path.resolve('dev-score.html') } },
});
