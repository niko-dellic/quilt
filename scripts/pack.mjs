import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
const out = resolve('artifacts/packages');
mkdirSync(out, { recursive: true });
const archives = [];
for (const name of ['core', 'dom', 'react', 'three']) {
  const result = JSON.parse(
    execFileSync('npm', ['pack', '--json', '--pack-destination', out], {
      cwd: resolve('packages', name),
      encoding: 'utf8',
    }),
  )[0];
  const path = resolve(out, result.filename);
  archives.push({
    name: result.name,
    version: result.version,
    file: result.filename,
    sha256: createHash('sha256').update(readFileSync(path)).digest('hex'),
  });
}
let commit = null;
try {
  commit = execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
} catch {}
let dirty = null;
try {
  dirty = Boolean(
    execFileSync('git', ['status', '--porcelain'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim(),
  );
} catch {}
writeFileSync(
  resolve(out, 'manifest.json'),
  JSON.stringify(
    { repository: 'https://github.com/niko-dellic/quilt', commit, dirty, packages: archives },
    null,
    2,
  ) + '\n',
);
console.log(archives.map((a) => a.file).join('\n'));
