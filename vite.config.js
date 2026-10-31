import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  resolve: {
    // Development test photos stay out of production builds entirely.
    alias:
      command === 'build'
        ? [
            {
              find: /^.*\/photo-demo\.js$/,
              replacement: fileURLToPath(new URL('./src/lib/photo-demo.stub.js', import.meta.url)),
            },
          ]
        : [],
  },
  // strictPort so we fail loudly instead of silently picking another port.
  server: {
    port: 5182,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://127.0.0.1:3010', changeOrigin: false, timeout: 120000, proxyTimeout: 120000 },
    },
  },
}))
