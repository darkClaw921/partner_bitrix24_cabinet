import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/b24/api': {
        target: 'http://b24-service:7860',
        changeOrigin: true,
        rewrite: (p: string) => p.replace(/^\/b24/, ''),
      },
      '/api': {
        target: 'http://backend:8003',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://backend:8003',
        changeOrigin: true,
      },
      '/b24': {
        target: 'http://b24-frontend:3000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
