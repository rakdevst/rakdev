import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'clean-urls-rewriter',
        configureServer(server) {
          server.middlewares.use((req, _res, next) => {
            if (req.url) {
              const [pathname, search] = req.url.split('?');
              const clean = pathname.toLowerCase().replace(/\/+$/, '');
              const query = search ? '?' + search : '';
              const routes: Record<string, string> = {
                '/dashboard': '/index.html',
                '/login': '/login.html',
                '/register': '/register.html',
                '/endorser': '/endorser/endorser.html',
                '/endorser.html': '/endorser/endorser.html',
                '/endorser/endorser.html': '/endorser/endorser.html',
                '/endorser.css': '/endorser/endorser.css',
                '/endorser.js': '/endorser/endorser.js',
                '/resources': '/resources.html',
                '/tutorial': '/tutorial.html',
                '/tutorial.html': '/tutorial.html',
                '/admin': '/admin.html',
              };
              if (routes[clean]) {
                req.url = routes[clean] + query;
              }
            }
            next();
          });
        },
        configurePreviewServer(server) {
          server.middlewares.use((req, _res, next) => {
            if (req.url) {
              const [pathname, search] = req.url.split('?');
              const clean = pathname.toLowerCase().replace(/\/+$/, '');
              const query = search ? '?' + search : '';
              const routes: Record<string, string> = {
                '/dashboard': '/index.html',
                '/login': '/login.html',
                '/register': '/register.html',
                '/endorser': '/endorser/endorser.html',
                '/endorser.html': '/endorser/endorser.html',
                '/endorser/endorser.html': '/endorser/endorser.html',
                '/endorser.css': '/endorser/endorser.css',
                '/endorser.js': '/endorser/endorser.js',
                '/resources': '/resources.html',
                '/tutorial': '/tutorial.html',
                '/tutorial.html': '/tutorial.html',
                '/admin': '/admin.html',
              };
              if (routes[clean]) {
                req.url = routes[clean] + query;
              }
            }
            next();
          });
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    preview: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true,
    },
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          admin: path.resolve(__dirname, 'admin.html'),
          endorser: path.resolve(__dirname, 'endorser/endorser.html'),
          endorser_root: path.resolve(__dirname, 'ENDORSER.html'),
          login: path.resolve(__dirname, 'login.html'),
          register: path.resolve(__dirname, 'register.html'),
          resources: path.resolve(__dirname, 'resources.html'),
          tutorial: path.resolve(__dirname, 'tutorial.html'),
          notfound: path.resolve(__dirname, '404.html'),
        },
      },
    },
  };
});
