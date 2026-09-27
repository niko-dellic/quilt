import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Reuse VitePress's rendered navbar, assets, search index, and page runtime. */
export function withSiteNavbar(html, page, site) {
  html = html
    .replace(/<!--quilt-site-assets:start-->[\s\S]*?<!--quilt-site-assets:end-->/g, '')
    .replace(
      /<!--quilt-site-navbar:start-->[\s\S]*?<!--quilt-site-navbar:end-->/g,
      '<!--quilt-site-navbar-->',
    );
  const shell = readFileSync(resolve(site, `${page}.html`), 'utf8');
  const head = shell.match(/<head>([\s\S]*?)<\/head>/)?.[1];
  const body = shell.match(/<body[^>]*>([\s\S]*?)<\/body>/)?.[1];
  if (!head || !body || !html.includes('<!--quilt-site-navbar-->'))
    throw new Error(`Missing site navbar template for ${page}`);
  // Keep the demo's own title and metadata, while loading the exact site assets.
  const assets = head.replace(/<title>[\s\S]*?<\/title>|<meta\b[^>]*>/g, '');
  return html
    .replace(
      '</head>',
      `<!--quilt-site-assets:start-->${assets}<!--quilt-site-assets:end--></head>`,
    )
    .replace(
      '<!--quilt-site-navbar-->',
      `<!--quilt-site-navbar:start-->${body}<!--quilt-site-navbar:end-->`,
    );
}
