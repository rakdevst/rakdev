import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [
    {
      name: 'clean-url-rewrite',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url) {
            const [rawPath, query] = req.url.split('?');
            const queryString = query ? `?${query}` : '';
            const normalized = rawPath.replace(/\/+$/, '').toLowerCase() || '/';

            const routes: Record<string, string> = {
              '/': '/index.html',
              '/dashboard': '/index.html',
              '/dash': '/index.html',
              '/endorser': '/endorser.html',
              '/endorse': '/endorser.html',
              '/endorsers': '/endorser.html',
              '/resources': '/resources.html',
              '/resource': '/resources.html',
              '/tutorial': '/tutorial.html',
              '/tutorials': '/tutorial.html',
              '/admin': '/admin.html',
              '/login': '/login.html',
              '/register': '/register.html',
            };

            if (routes[normalized]) {
              req.url = routes[normalized] + queryString;
            }
          }
          next();
        });
      },
    },
  ],
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        endorser: path.resolve(__dirname, 'endorser.html'),
        resources: path.resolve(__dirname, 'resources.html'),
        tutorial: path.resolve(__dirname, 'tutorial.html'),
        admin: path.resolve(__dirname, 'admin.html'),
        login: path.resolve(__dirname, 'login.html'),
        register: path.resolve(__dirname, 'register.html'),
        notfound: path.resolve(__dirname, '404.html'),
      },
    },
  },
});
