import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'redirect-therapy',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          // Redirect /therapy to /therapy/
          if (req.url === '/therapy') {
            res.writeHead(302, { Location: '/therapy/' });
            res.end();
            return;
          }
          next();
        });
      },
    },
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
  base: '/therapy/',
})
