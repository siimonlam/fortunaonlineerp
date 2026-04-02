import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    port: 3000,
  },
  publicDir: 'public',
  assetsInclude: ['**/*.pdf', '**/*.docx', '**/*.jpg', '**/*.jpeg', '**/*.png', '**/*.ps'],
  build: {
    assetsInlineLimit: 0,
  },
});
