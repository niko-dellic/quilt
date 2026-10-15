import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const read = (path) => JSON.parse(readFileSync(path, 'utf8'));
const version = process.env.RELEASE_VERSION;
assert.match(
  version ?? '',
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/,
  'RELEASE_VERSION must be a stable semver',
);
const packages = ['core', 'dom', 'react', 'three', 'three-react'].map((key) =>
  read(`packages/${key}/package.json`),
);
assert.equal(read('package.json').version, version);
for (const p of packages) {
  assert.equal(p.version, version);
  for (const other of packages)
    for (const field of ['dependencies', 'peerDependencies'])
      if (p[field]?.[other.name]) assert.equal(p[field][other.name], version);
}
const changelog = readFileSync('CHANGELOG.md', 'utf8');
const heading = `## ${version}\n`;
assert.ok(changelog.includes(heading), 'Add release notes to CHANGELOG.md');
const notes = changelog.split(heading)[1].split('\n## ')[0].trim();
assert.ok(notes, 'Release notes cannot be empty');
if (process.argv.includes('--validate')) process.exit(0);
const manifest = read('artifacts/packages/manifest.json');
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
assert.equal(manifest.commit, commit);
assert.equal(manifest.dirty, false);
assert.equal(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(), '');
const publish = process.argv.includes('--publish');
const plan = [];
for (const p of packages) {
  const archive = manifest.packages.find((a) => a.name === p.name);
  assert.equal(archive?.version, version);
  assert.ok(archive.file === `${p.name}-${version}.tgz`, 'Unexpected archive filename');
  const file = `artifacts/packages/${archive.file}`;
  const bytes = readFileSync(file);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), archive.sha256);
  const integrity = 'sha512-' + createHash('sha512').update(bytes).digest('base64');
  let exists = false;
  if (publish) {
    const response = await fetch(`https://registry.npmjs.org/${p.name}/${version}`);
    if (response.ok) {
      assert.equal(
        (await response.json()).dist.integrity,
        integrity,
        `${p.name}@${version} already exists with different contents; use a new version`,
      );
      exists = true;
    } else assert.equal(response.status, 404, 'Registry lookup failed');
  }
  plan.push({ file, name: p.name, exists });
}
// Complete preflight for every package before publishing the first one.
for (const p of plan) {
  if (p.exists) {
    console.log(`Verified already-published ${p.name}@${version}`);
    continue;
  }
  execFileSync(
    'npm',
    publish
      ? ['publish', p.file, '--access=public', '--registry=https://registry.npmjs.org/']
      : ['pack', p.file, '--dry-run', '--ignore-scripts'],
    { stdio: 'inherit' },
  );
}
writeFileSync('artifacts/packages/release-notes.md', notes + '\n');
