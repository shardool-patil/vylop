import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // This forces the browser to look at the root /assets/ instead of /auth/assets/
  base: '/', 
  build: {
    outDir: 'dist',
  }
})