import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { mockApi } from './mock/mockApi'

// The redesigned app ("מחברת שטח"). Served at /therapy/; the previous app is kept at /therapy-classic/.
// In dev, /api is answered by an in-memory mock (mock/mockApi.ts) — there is
// deliberately NO proxy to the real server, which uses the production Firestore.
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'redirect-therapy',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/therapy' || req.url === '/') {
            res.writeHead(302, { Location: '/therapy/' });
            res.end();
            return;
          }
          next();
        });
      },
    },
    {
      name: 'mock-api',
      configureServer(server) {
        server.middlewares.use(mockApi());
      },
    },
  ],
  server: {
    port: 5199,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
  },
  base: '/therapy/',
})
