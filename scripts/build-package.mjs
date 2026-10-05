import { execFileSync } from 'node:child_process';
import { copyFileSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const order = ['core', 'dom', 'react'];
const target = process.argv[2];
if (!order.includes(target)) throw new Error('Expected core, dom, or react');
const packages = process.argv.includes('--dependencies')
  ? order.slice(0, order.indexOf(target) + 1)
  : [target];
for (const name of packages) {
  const directory = resolve(root, 'packages', name);
  rmSync(resolve(directory, 'dist'), { recursive: true, force: true });
  execFileSync(
    process.execPath,
    [resolve(root, 'node_modules/typescript/bin/tsc'), '-p', resolve(directory, 'tsconfig.json')],
    { stdio: 'inherit' },
  );
  if (name !== 'core') {
    writeFileSync(
      resolve(directory, 'dist/styles.css'),
      readFileSync(
        fileURLToPath(import.meta.resolve('overlayscrollbars/overlayscrollbars.css')),
        'utf8',
      ) +
        '\n' +
        readFileSync(resolve(root, 'packages/dom/src/styles.css'), 'utf8'),
    );
    copyFileSync(
      resolve(root, 'packages/dom/src/styles.css.d.ts'),
      resolve(directory, 'dist/styles.css.d.ts'),
    );
  }
}
