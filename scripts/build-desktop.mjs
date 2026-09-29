import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { build } from 'vite';
import builder from '../desktop/builder.cjs';
const { version, devDependencies } = JSON.parse(readFileSync('package.json', 'utf8'));
await build({ configFile: 'desktop/vite.config.mjs' });
const app = 'artifacts/desktop/app';
mkdirSync(app, { recursive: true });
copyFileSync('desktop/main.cjs', app + '/main.cjs');
copyFileSync('LICENSE', app + '/LICENSE');
writeFileSync(
  app + '/package.json',
  JSON.stringify(
    {
      name: 'quilt-desktop-demo',
      productName: 'Quilt Demo',
      version,
      description: 'The Quilt workspace showcase for desktop',
      author: 'Quilt contributors',
      license: 'MIT',
      main: 'main.cjs',
      homepage: 'https://github.com/niko-dellic/quilt',
    },
    null,
    2,
  ) + '\n',
);
// Keep the packager runtime aligned with the tested Electron version.
if (devDependencies.electron !== builder.electronVersion)
  throw new Error('Update desktop/builder.cjs to match Electron');
if (process.argv.includes('--package')) {
  execFileSync(
    process.execPath,
    [
      'node_modules/electron-builder/cli.js',
      '--config',
      'desktop/builder.cjs',
      '--publish',
      'never',
      ...process.argv.slice(2).filter((arg) => arg !== '--package'),
    ],
    { stdio: 'inherit' },
  );
}
