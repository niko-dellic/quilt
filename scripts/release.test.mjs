import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const files = [
  'package.json',
  'package-lock.json',
  'packages/core/package.json',
  'packages/dom/package.json',
  'packages/react/package.json',
  'packages/three/package.json',
  'packages/three-react/package.json',
  'CHANGELOG.md',
  'examples/vanilla/package.json',
  'examples/react/package.json',
  'examples/electron/package.json',
];
function fixture(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'quilt-release-test-'));
  try {
    for (const file of files) {
      const target = join(dir, file);
      mkdirSync(resolve(target, '..'), { recursive: true });
      writeFileSync(target, readFileSync(file));
    }
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
const run = (file, dir, args = [], env = {}) =>
  spawnSync(process.execPath, [resolve('scripts', file), ...args], {
    cwd: dir,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
test('version command rejects invalid/decreasing input without writes and updates all dependencies and lockfile', () =>
  fixture((dir) => {
    const before = readFileSync(join(dir, 'package.json'), 'utf8');
    const current = JSON.parse(before).version;
    const next = `${Number(current.split('.')[0]) + 1}.0.0`;
    for (const version of ['0.0.0', current, 'bad', '1.2.3;echo bad']) {
      assert.notEqual(run('release-version.mjs', dir, [version]).status, 0);
      assert.equal(readFileSync(join(dir, 'package.json'), 'utf8'), before);
    }
    assert.equal(run('release-version.mjs', dir, [next]).status, 0);
    const read = (file) => JSON.parse(readFileSync(join(dir, file), 'utf8'));
    for (const file of files.filter(
      (f) => f.endsWith('package.json') && !f.startsWith('examples/'),
    ))
      assert.equal(read(file).version, next);
    assert.equal(read('packages/react/package.json').dependencies['quilt-vanilla'], next);
    assert.equal(read('packages/three-react/package.json').dependencies['quilt-react'], next);
    assert.equal(read('examples/react/package.json').dependencies['quilt-react'], next);
    assert.equal(
      read('package-lock.json').packages['packages/dom'].dependencies['quilt-core'],
      next,
    );
  }));
test('release validation rejects version mismatches and missing notes before publishing', () =>
  fixture((dir) => {
    const version = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).version;
    assert.equal(run('release.mjs', dir, ['--validate'], { RELEASE_VERSION: version }).status, 0);
    assert.notEqual(
      run('release.mjs', dir, ['--validate'], { RELEASE_VERSION: '9.9.9' }).status,
      0,
    );
    writeFileSync(join(dir, 'CHANGELOG.md'), '# Changelog\n');
    assert.notEqual(
      run('release.mjs', dir, ['--validate'], { RELEASE_VERSION: version }).status,
      0,
    );
  }));
