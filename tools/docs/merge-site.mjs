import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { withSiteNavbar } from './navbar.mjs';
const source = new URL('../../docs/.vitepress/site/', import.meta.url);
const destination = new URL('../../dist/', import.meta.url);
mkdirSync(destination, { recursive: true });
rmSync(new URL('docs/', destination), { recursive: true, force: true });
const demos = ['vanilla', 'react', 'electron'].map((page) => [
  page,
  readFileSync(new URL(`${page}.html`, destination), 'utf8'),
]);
cpSync(source, destination, { recursive: true });
for (const [page, html] of demos)
  writeFileSync(
    new URL(`${page}.html`, destination),
    withSiteNavbar(html, page, fileURLToPath(source)),
  );
