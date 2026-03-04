import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // CRITICAL FIX: Use '/' so assets load correctly from any sub-path like /auth
  base: '/', 
  build: {
    outDir: 'dist',
  }
})