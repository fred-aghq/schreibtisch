import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// BASE_PATH lets the same build serve from "/" (Docker) or "/schreibtisch/" (GitHub Pages).
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [react()],
  // The 3D chunk (three.js) is lazy-loaded, so its size doesn't affect first paint.
  build: { chunkSizeWarningLimit: 1200 },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
