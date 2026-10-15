import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import assert from 'node:assert/strict';
const paths = [
  'package.json',
  'packages/core/package.json',
  'packages/dom/package.json',
  'packages/react/package.json',
  'packages/three/package.json',
  'packages/three-react/package.json',
];
const read = (path) => JSON.parse(readFileSync(path, 'utf8'));
const manifests = paths.map(read);
const version = process.argv[2];
assert.match(
  version ?? '',
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/,
  'Pass a stable version, for example npm run release:version -- 0.1.1',
);
assert.ok(
  version
    .split('.')
    .map(Number)
    .some(
      (n, i, next) =>
        n > Number(manifests[0].version.split('.')[i]) &&
        next.slice(0, i).every((p, j) => p === Number(manifests[0].version.split('.')[j])),
    ),
  'Version must increase',
);
const names = manifests.slice(1).map((m) => m.name);
const lock = read('package-lock.json');
for (let i = 0; i < paths.length; i++) {
  const m = manifests[i];
  m.version = version;
  for (const field of ['dependencies', 'peerDependencies'])
    for (const name of names) if (m[field]?.[name]) m[field][name] = version;
  const key = i === 0 ? '' : paths[i].replace('/package.json', '');
  lock.packages[key].version = version;
  if (m.dependencies) lock.packages[key].dependencies = m.dependencies;
  if (m.peerDependencies) lock.packages[key].peerDependencies = m.peerDependencies;
}
lock.version = version;
for (let i = 0; i < paths.length; i++)
  writeFileSync(paths[i], JSON.stringify(manifests[i], null, 2) + '\n');
for (const example of ['vanilla', 'react', 'electron']) {
  const path = 'examples/' + example + '/package.json';
  if (!existsSync(path)) continue;
  const manifest = read(path);
  for (const name of names)
    if (manifest.dependencies?.[name]) manifest.dependencies[name] = version;
  writeFileSync(path, JSON.stringify(manifest, null, 2) + '\n');
}
writeFileSync('package-lock.json', JSON.stringify(lock, null, 2) + '\n');
console.log(
  `Set all packages to ${version}. Add a ## ${version} entry to CHANGELOG.md, then open a pull request.`,
);
