// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // Production domain — enables canonical URLs, absolute social-share URLs and
  // the generated sitemap. Apex is the canonical form; www redirects to it.
  site: 'https://pratenici.mk',
  integrations: [react(), sitemap()],

  vite: {
    plugins: [tailwindcss()]
  }
});