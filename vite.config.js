import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // strictPort so we fail loudly instead of silently picking another port.
  server: { port: 5182, strictPort: true },
})
