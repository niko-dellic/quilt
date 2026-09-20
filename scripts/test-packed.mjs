import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  rmSync,
  realpathSync,
  existsSync,
  mkdirSync,
  copyFileSync,
  readdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { build, preview } from 'vite';
import { chromium } from '@playwright/test';
const root = fileURLToPath(new URL('../', import.meta.url));
const run = (command, args, cwd = root) => execFileSync(command, args, { cwd, stdio: 'inherit' });
// Exercise a leaf package's prepack from a clean workspace, then pack all
// packages with stale outputs present to verify clean builds remove them.
for (const name of ['core', 'dom', 'react']) {
  rmSync(resolve(root, 'packages', name, 'dist'), { recursive: true, force: true });
}
const direct = mkdtempSync(join(tmpdir(), 'quilt-direct-pack-'));
try {
  run('npm', ['pack', '--pack-destination', direct], resolve(root, 'packages/react'));
} finally {
  rmSync(direct, { recursive: true, force: true });
}
for (const name of ['core', 'dom', 'react']) {
  writeFileSync(resolve(root, 'packages', name, 'dist/stale.js'), 'throw new Error("stale");');
}
run(process.execPath, ['scripts/pack.mjs']);
for (const name of ['core', 'dom', 'react']) {
  assert.equal(existsSync(resolve(root, 'packages', name, 'dist/stale.js')), false);
}
const manifest = JSON.parse(
  readFileSync(resolve(root, 'artifacts/packages/manifest.json'), 'utf8'),
);
const metadata = Object.fromEntries(
  ['core', 'dom', 'react'].map((key) => [
    key,
    JSON.parse(readFileSync(resolve(root, `packages/${key}/package.json`), 'utf8')),
  ]),
);
const temp = realpathSync(mkdtempSync(join(tmpdir(), 'quilt-consumer-')));
const installFlags = ['--ignore-scripts', '--no-audit', '--no-fund'];
try {
  const vendor = join(temp, 'vendor');
  mkdirSync(vendor);
  for (const p of manifest.packages)
    copyFileSync(resolve(root, 'artifacts/packages', p.file), join(vendor, p.file));
  const archive = (key) =>
    `file:vendor/${manifest.packages.find((p) => p.name === metadata[key].name).file}`;
  writeFileSync(
    join(temp, 'package.json'),
    JSON.stringify({
      name: 'isolated-quilt-consumer',
      private: true,
      type: 'module',
      dependencies: { [metadata.core.name]: archive('core'), [metadata.dom.name]: archive('dom') },
    }),
  );
  run('npm', ['install', ...installFlags], temp);
  assert.equal(
    existsSync(join(temp, 'node_modules/react')),
    false,
    'Vanilla must not install React',
  );
  writeFileSync(
    join(temp, 'smoke.mjs'),
    `import assert from 'node:assert/strict'; import { LayoutStore, createLayout } from '${metadata.core.name}'; import { Workspace } from '${metadata.dom.name}'; const store = new LayoutStore(createLayout()); store.add({ id:'a', title:'A', type:'text' }, 'main'); assert.equal(store.export().panes.a.id, 'a'); assert.equal(typeof Workspace, 'function'); store.dispose();`,
  );
  run(process.execPath, ['smoke.mjs'], temp);
  for (const file of ['core-consumer.ts', 'dom-consumer.ts', 'consumer.tsx']) {
    let source = readFileSync(resolve(root, 'scripts/fixtures', file), 'utf8');
    for (const [old, key] of [
      ['quilt-core', 'core'],
      ['quilt-react', 'react'],
      ['quilt-vanilla', 'dom'],
    ])
      source = source
        .replaceAll(`'${old}'`, `'${metadata[key].name}'`)
        .replaceAll(`'${old}/styles.css'`, `'${metadata[key].name}/styles.css'`);
    writeFileSync(join(temp, file), source);
  }
  writeFileSync(
    join(temp, 'index.html'),
    '<div id="app"></div><script type="module" src="/consumer.tsx"></script>',
  );
  for (const version of ['18.3', '19']) {
    const major = version.split('.')[0];
    run(
      'npm',
      [
        'install',
        archive('react'),
        `react@${version}`,
        `react-dom@${version}`,
        `@types/react@${major}`,
        `@types/react-dom@${major}`,
        '@types/node@22',
        'typescript@~7.0.2',
        'typescript-legacy@npm:typescript@~5.9.3',
        ...installFlags,
      ],
      temp,
    );
    rmSync(join(temp, 'node_modules'), { recursive: true, force: true });
    run('npm', ['ci', ...installFlags], temp);
    run(process.execPath, ['smoke.mjs'], temp);
    for (const compiler of ['typescript-legacy', 'typescript']) {
      const tsc = join(temp, `node_modules/${compiler}/bin/tsc`);
      for (const mode of ['NodeNext', 'Bundler']) {
        const common = [
          '--noEmit',
          '--strict',
          '--exactOptionalPropertyTypes',
          '--noUncheckedSideEffectImports',
          '--skipLibCheck',
          'false',
          '--target',
          'ES2022',
          '--module',
          mode === 'Bundler' ? 'ESNext' : 'NodeNext',
          '--moduleResolution',
          mode,
        ];
        run(
          process.execPath,
          [tsc, ...common, '--lib', 'ES2022', '--types', 'node', 'core-consumer.ts'],
          temp,
        );
        run(
          process.execPath,
          [
            tsc,
            ...common,
            '--lib',
            'ES2022,DOM,DOM.Iterable',
            '--jsx',
            'react-jsx',
            'dom-consumer.ts',
            'consumer.tsx',
          ],
          temp,
        );
      }
    }
    for (const p of manifest.packages) {
      const location = realpathSync(join(temp, 'node_modules', p.name));
      assert.ok(location.startsWith(realpathSync(temp)), 'Packages must not link to checkout');
      assert.ok(existsSync(join(location, 'LICENSE')));
      for (const file of readdirSync(join(location, 'dist')).filter((f) =>
        f.endsWith('.d.ts.map'),
      )) {
        const map = JSON.parse(readFileSync(join(location, 'dist', file), 'utf8'));
        for (const source of map.sources)
          assert.ok(
            existsSync(resolve(location, 'dist', map.sourceRoot ?? '', source)),
            `${file} source must ship`,
          );
      }
    }
    const domCSS = readFileSync(join(temp, 'node_modules', metadata.dom.name, 'dist/styles.css'));
    assert.deepEqual(
      readFileSync(join(temp, 'node_modules', metadata.react.name, 'dist/styles.css')),
      domCSS,
    );
    writeFileSync(
      join(temp, 'css.mjs'),
      `import assert from 'node:assert/strict'; import { existsSync } from 'node:fs'; for (const name of ${JSON.stringify([metadata.dom.name, metadata.react.name])}) assert.ok(existsSync(new URL(import.meta.resolve(name + '/styles.css'))));`,
    );
    run(process.execPath, ['css.mjs'], temp);
    await build({
      configFile: false,
      root: temp,
      logLevel: 'error',
      esbuild: { jsx: 'automatic' },
      build: { outDir: 'site', emptyOutDir: true },
    });
    const server = await preview({
      configFile: false,
      root: temp,
      build: { outDir: 'site' },
      preview: { host: '127.0.0.1', port: 0 },
    });
    let browser;
    try {
      browser = await chromium.launch();
      const page = await browser.newPage();
      page.setDefaultTimeout(15000);
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(server.resolvedUrls.local[0]);
      await page.getByRole('textbox', { name: 'Note data' }).fill('retained');
      await page.waitForFunction(() => window.consumer.state.text === 'retained');
      await page.waitForFunction(() => window.consumer.stats.live === 1);
      await page.evaluate(() =>
        window.consumer.store.updatePane({ id: 'note', type: 'note', title: 'Renamed' }),
      );
      await page.waitForFunction(() => document.querySelector('output').textContent === 'Renamed');
      const popupPromise = page.waitForEvent('popup');
      await page.getByRole('button', { name: 'Pop out', exact: true }).click();
      const popup = await popupPromise;
      await popup.getByRole('textbox', { name: 'Note data' }).waitFor();
      assert.equal(
        await popup.getByRole('textbox', { name: 'Note data' }).inputValue(),
        'retained',
      );
      await popup.getByRole('textbox', { name: 'Note data' }).fill('returned');
      await popup.close();
      await page.getByRole('textbox', { name: 'Note data' }).waitFor();
      assert.equal(await page.getByRole('textbox', { name: 'Note data' }).inputValue(), 'returned');
      await page.evaluate(() => window.consumer.dispose());
      await page.waitForFunction(
        () => window.consumer.stats.live === 0 && !document.querySelector('.layouts'),
      );
      assert.equal(
        await page.evaluate(() => {
          try {
            window.consumer.store.on('change', () => {});
            return false;
          } catch {
            return true;
          }
        }),
        true,
      );
      assert.deepEqual(errors, []);
      console.log(
        `Packed React ${version}: types, mount, snapshot, popout, return, cleanup passed.`,
      );
    } finally {
      await browser?.close();
      await new Promise((resolve, reject) =>
        server.httpServer.close((error) => (error ? reject(error) : resolve())),
      );
    }
  }
  console.log('Isolated tarball checks passed.');
} finally {
  rmSync(temp, { recursive: true, force: true });
}
