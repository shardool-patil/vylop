import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // 🛑 THIS IS THE FIX: Force absolute paths starting with /
  base: '/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
})