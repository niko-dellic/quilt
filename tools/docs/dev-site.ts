import { execFile } from 'node:child_process';
import { createReadStream, statSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import type { Plugin } from 'vite';
import { withSiteNavbar } from './navbar.mjs';

const run = promisify(execFile);
const mime: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

/** Serve the same generated documentation and search index as the deployed site. */
export function documentationSite(): Plugin {
  let site: string;
  return {
    name: 'quilt-development-documentation',
    apply: 'serve',
    transformIndexHtml: {
      order: 'post',
      handler(html, context) {
        const page = context.path.match(/^\/(vanilla|react|electron)(?:\.html)?$/)?.[1];
        return page ? withSiteNavbar(html, page, site) : html;
      },
    },
    async configureServer(server) {
      const root = server.config.root;
      await run(process.execPath, ['generate.mjs'], {
        cwd: resolve(root, 'tools/docs'),
        maxBuffer: 16 * 1024 * 1024,
      });
      // VitePress sets NODE_ENV for its production build. Keep that state out of
      // the demo server, which needs React's development JSX runtime.
      site = mkdtempSync(resolve(tmpdir(), 'quilt-dev-docs-'));
      try {
        await run(
          process.execPath,
          [
            resolve(root, 'node_modules/vitepress/bin/vitepress.js'),
            'build',
            resolve(root, 'docs'),
            '--outDir',
            site,
          ],
          { cwd: root, maxBuffer: 16 * 1024 * 1024 },
        );
      } catch (error) {
        rmSync(site, { recursive: true, force: true });
        throw error;
      }
      server.httpServer?.once('close', () => rmSync(site, { recursive: true, force: true }));
      server.middlewares.use((request, response, next) => {
        if (request.method !== 'GET' && request.method !== 'HEAD') return next();
        let pathname: string;
        try {
          pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
        } catch {
          response.statusCode = 400;
          response.end('Invalid URL');
          return;
        }
        const document =
          pathname === '/' ||
          pathname === '/index.html' ||
          pathname === '/docs' ||
          pathname.startsWith('/docs/');
        const asset =
          pathname.startsWith('/assets/') ||
          pathname === '/hashmap.json' ||
          pathname === '/vp-icons.css';
        if (!document && !asset) return next();
        const base = resolve(site, `.${pathname}`);
        if (base !== site && !base.startsWith(site + sep)) return next();
        const candidates = document ? [base, `${base}.html`, resolve(base, 'index.html')] : [base];
        const file = candidates.find((candidate) => {
          try {
            return statSync(candidate).isFile();
          } catch {
            return false;
          }
        });
        if (!file && !document) return next();
        const target = file ?? resolve(site, '404.html');
        response.statusCode = file ? 200 : 404;
        response.setHeader('Content-Type', mime[extname(target)] ?? 'application/octet-stream');
        response.setHeader('Cache-Control', 'no-cache');
        if (request.method === 'HEAD') return response.end();
        const stream = createReadStream(target);
        response.on('close', () => stream.destroy());
        stream.on('error', (error) => response.destroy(error));
        stream.pipe(response);
      });
    },
  };
}
