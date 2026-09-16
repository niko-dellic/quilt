import { readdirSync, readFileSync, existsSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
const root = resolve('dist/docs');
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? files(resolve(dir, entry.name)) : [resolve(dir, entry.name)],
  );
}
const pages = files(root).filter((file) => file.endsWith('.html'));
const failures = new Set();
const cache = new Map();
for (const file of pages) {
  const html = readFileSync(file, 'utf8');
  for (const match of html.matchAll(/href="([^"<>]+)"/g)) {
    const href = match[1].replaceAll('&amp;', '&');
    if (/^(?:[a-z]+:|\/\/)/i.test(href) || (href.startsWith('/') && !href.startsWith('/docs/')))
      continue;
    const url = new URL(href, 'https://docs.test/docs/' + relative(root, file));
    if (!url.pathname.startsWith('/docs/')) continue;
    let target = resolve(root, decodeURIComponent(url.pathname.slice(6)));
    if (existsSync(target) && statSync(target).isDirectory())
      target = resolve(target, 'index.html');
    else if (!existsSync(target) && existsSync(target + '.html')) target += '.html';
    if (!existsSync(target)) {
      failures.add(`${relative(root, file)} → missing ${href}`);
      continue;
    }
    if (url.hash && target.endsWith('.html')) {
      if (!cache.has(target)) cache.set(target, readFileSync(target, 'utf8'));
      const id = decodeURIComponent(url.hash.slice(1));
      if (!cache.get(target).includes(`id="${id}"`))
        failures.add(`${relative(root, file)} → missing anchor ${href}`);
    }
  }
}
if (failures.size) throw new Error([...failures].join('\n'));
const snippets = resolve('artifacts/docs-snippets');
mkdirSync(snippets, { recursive: true });
for (const [name, language] of [
  ['vanilla', 'ts'],
  ['react', 'tsx'],
]) {
  const markdown = readFileSync(`docs/quickstart-${name}.md`, 'utf8');
  const code = markdown.match(new RegExp('```' + language + '\\n([\\s\\S]*?)```'))?.[1];
  if (!code) throw new Error(`Missing ${name} quickstart`);
  writeFileSync(
    resolve(snippets, `${name}.${language}`),
    code + '\nexport { disposeWorkspace };\n',
  );
}
writeFileSync(
  resolve(snippets, 'tsconfig.json'),
  JSON.stringify({
    extends: '../../tsconfig.json',
    compilerOptions: { noEmit: true },
    include: ['*.ts', '*.tsx'],
  }),
);
execFileSync(
  process.execPath,
  ['node_modules/typescript/bin/tsc', '-p', resolve(snippets, 'tsconfig.json')],
  { stdio: 'inherit' },
);
console.log(
  `Checked links and anchors in ${pages.length} documentation pages and type-checked both quickstarts.`,
);
