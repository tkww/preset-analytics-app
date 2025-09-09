import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Adjust base for GitHub Pages (repo name)
export default defineConfig({
  plugins: [react()],
  base: '/preset-analytics-app/'
});
