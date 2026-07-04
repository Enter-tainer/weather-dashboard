import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function fixtureServer(): Plugin {
  return {
    name: 'fixture-server',
    configureServer(server) {
      server.middlewares.use('/fixtures', (req, res, next) => {
        const url = new URL(req.url ?? '', `http://${req.headers.host}`);
        if (!url.pathname.endsWith('.json')) return next();

        const relative = url.pathname.replace(/^\/fixtures\//, '').replace(/^\//, '');
        const filePath = resolve(process.cwd(), 'fixtures', relative);
        try {
          const data = readFileSync(filePath, 'utf-8');
          res.setHeader('Content-Type', 'application/json');
          res.end(data);
        } catch {
          res.statusCode = 404;
          res.end('Not found');
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), fixtureServer()],
});
