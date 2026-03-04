import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Standard default config
export default defineConfig({
  plugins: [react()],
  // No 'base' property needed for root deployments on Render
  build: {
    outDir: 'dist',
  }
})