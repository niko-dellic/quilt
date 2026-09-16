import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { format } from 'prettier';
const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const source = read('README.md');
const check = process.argv.includes('--check');
for (const pkg of ['core', 'dom', 'react']) {
  const path = `packages/${pkg}/README.md`;
  let output = read(path);
  for (const section of ['overview', 'docs']) {
    const start = `<!-- shared-${section}:start -->`;
    const end = `<!-- shared-${section}:end -->`;
    if (!source.includes(start) || !source.includes(end)) throw new Error(`Missing ${section}`);
    const content = source
      .split(start)[1]
      .split(end)[0]
      .trim()
      .replace(/(!?\[[^\]]*\])\(([^)]+)\)/g, (match, label, url) =>
        /^(https?:|#)/.test(url)
          ? match
          : `${label}(https://${label.startsWith('!') ? 'raw.githubusercontent.com/niko-dellic/quilt/main' : 'github.com/niko-dellic/quilt/blob/main'}/${url})`,
      );
    const block = `${start}\n\n${content}\n\n${end}`;
    if (output.includes(start)) {
      const before = output.slice(0, output.indexOf(start));
      const after = output.slice(output.indexOf(end) + end.length);
      output = before + block + after;
    } else if (section === 'overview')
      output = output.replace('## Install', `${block}\n\n## Install`);
    else output = output.trimEnd() + `\n\n${block}\n`;
  }
  output = await format(output, { filepath: path });
  if (check && output !== read(path)) throw new Error(`${path} is stale. Run npm run docs:sync.`);
  if (!check) writeFileSync(resolve(root, path), output);
}
console.log(check ? 'Package READMEs are synchronized.' : 'Updated package READMEs.');
