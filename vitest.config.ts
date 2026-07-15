import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Pruebas unitarias de lógica pura (sin DOM, sin Supabase real) — sistema de
// etiquetado alimentario. Ver docs/FOOD_LABEL_ADMIN_DESIGN.md.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
