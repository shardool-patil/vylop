import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // --- ADDED THIS: Ensures all paths resolve to root ---
  base: '/', 
  server: {
    watch: {
      usePolling: true,
    },
    // Optional: Help for local testing if needed
    historyApiFallback: true, 
  },
  build: {
    outDir: 'dist',
  }
})