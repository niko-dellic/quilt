import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
export default defineConfig({
  base: './',
  plugins: [
    {
      name: 'quilt-desktop-html',
      transformIndexHtml: (html) =>
        html
          .replaceAll('__QUILT_VERSION__', version)
          .replaceAll('href="/docs/"', 'href="https://quilt-layouts.vercel.app/docs/"')
          .replaceAll('href="/"', 'href="./vanilla.html"')
          .replaceAll('href="/vanilla.html"', 'href="./vanilla.html"')
          .replaceAll('href="/react.html"', 'href="./react.html"')
          .replace(
            /<a href="\/electron.html">Electron<\/a>/g,
            '<span style="padding:6px 12px">Desktop demo</span>',
          ),
    },
  ],
  build: {
    outDir: 'artifacts/desktop/app/site',
    emptyOutDir: true,
    rolldownOptions: { input: { vanilla: resolve('vanilla.html'), react: resolve('react.html') } },
  },
});
