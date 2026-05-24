import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  integrations: [react()],
  // Single-page interactive site; no SSR/server rendering needed.
  output: 'static',
});
