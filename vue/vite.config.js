import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = fileURLToPath(new URL('.', import.meta.url));
const casesDir = path.resolve(rootDir, '../ok/cases');

function serveOkCases() {
  return {
    name: 'serve-ok-cases',
    configureServer(server) {
      server.middlewares.use('/cases', (req, res, next) => {
        const relative = decodeURIComponent(String(req.url || '').split('?')[0]).replace(/^\/+/, '');
        const file = path.resolve(casesDir, relative);
        if (!file.startsWith(casesDir) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
          next();
          return;
        }
        fs.createReadStream(file).pipe(res);
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [vue(), serveOkCases()],
  resolve: {
    alias: {
      '@': path.resolve(rootDir, 'src'),
    },
  },
  server: {
    fs: {
      allow: [rootDir, path.resolve(rootDir, '../ok')],
    },
  },
});
