import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const base = process.env.VITE_BASE_PATH || '/'
const apiTarget = process.env.VITE_API_TARGET || 'http://localhost:7860'

export default defineConfig({
  plugins: [react()],
  base,
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    port: 3000,
    allowedHosts: true,
    proxy: {
      '/api/public': {
        target: apiTarget,
        changeOrigin: true,
        rewrite: (p: string) => p.replace(/^\/api\/public/, '/api/v1/public'),
      },
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
})
