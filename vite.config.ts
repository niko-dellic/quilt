import { defineConfig } from 'vite';
import { documentationSite } from './tools/docs/dev-site.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const { version } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version: string };
export default defineConfig({
  plugins: [
    documentationSite(),
    {
      name: 'quilt-site-version',
      transformIndexHtml: (html) => html.replaceAll('__QUILT_VERSION__', version),
    },
  ],
  server: {
    host: 'localhost',
    port: 5186,
    strictPort: true,
    watch: {
      ignored: [
        '**/docs/.vitepress/site/**',
        '**/docs/.vitepress/cache/**',
        '**/docs/api-reference/**',
      ],
    },
  },
  build: {
    rolldownOptions: {
      input: {
        vanilla: resolve('vanilla.html'),
        react: resolve('react.html'),
        electron: resolve('electron.html'),
      },
    },
  },
});
