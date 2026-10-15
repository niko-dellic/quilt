import { Application } from 'typedoc';
import { fileURLToPath } from 'node:url';
import { resolve, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
import { rmSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const out = resolve(root, 'docs/api-reference');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const version = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).version;
// Deployment checkouts may omit Git metadata or release tags. Pin links to the
// actual source commit instead of assuming a version tag already exists.
let sourceRevision = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA;
if (!sourceRevision) {
  try {
    sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
    }).trim();
  } catch {
    sourceRevision = 'main';
  }
}
if (!/^(?:[a-f0-9]{40}|main)$/.test(sourceRevision)) throw new Error('Invalid source revision');
for (const [folder, name, entry] of [
  ['core', 'quilt-core'],
  ['dom', 'quilt-vanilla'],
  ['react', 'quilt-react'],
  ['three', 'quilt-three'],
  ['three-react', 'quilt-three-react', 'index.tsx'],
  ['three', 'quilt-three-webgpu', 'webgpu.ts'],
]) {
  const app = await Application.bootstrapWithPlugins({
    entryPoints: [
      resolve(
        root,
        `packages/${folder}/src/${entry ?? `index.${folder === 'react' ? 'tsx' : 'ts'}`}`,
      ),
    ],
    tsconfig: resolve(root, 'tools/docs/tsconfig.json'),
    plugin: ['typedoc-plugin-markdown'],
    name,
    out: resolve(out, name),
    readme: 'none',
    excludePrivate: true,
    excludeInternal: true,
    disableSources: false,
    disableGit: true,
    basePath: root,
    sourceLinkTemplate: `https://github.com/niko-dellic/quilt/blob/${sourceRevision}/{path}#L{line}`,
    entryFileName: 'index.md',
    hidePageHeader: true,
    hideBreadcrumbs: true,
    useHTMLAnchors: true,
  });
  const project = await app.convert();
  if (!project) throw new Error(`Cannot generate ${name} reference`);
  // Only repository-owned sources belong in Quilt GitHub links. Inherited
  // standard-library/dependency members retain their inheritance information,
  // without leaking machine-specific node_modules paths into the public docs.
  for (const reflection of Object.values(project.reflections)) {
    if (!reflection.sources) continue;
    reflection.sources = reflection.sources.filter((source) => {
      const path = relative(root, source.fullFileName).replaceAll('\\', '/');
      if (!path.startsWith('packages/') || path.includes('/node_modules/')) return false;
      source.fileName = path;
      source.url = `https://github.com/niko-dellic/quilt/blob/${sourceRevision}/${path}#L${source.line}`;
      return true;
    });
    if (!reflection.sources.length) delete reflection.sources;
  }
  await app.generateOutputs(project);
  // Re-exported names occur in more than one adapter. Include the package in
  // headings so search results identify which public import they describe.
  function annotate(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) annotate(path);
      else if (entry.name.endsWith('.md')) {
        const markdown = readFileSync(path, 'utf8');
        const labelled =
          entry.name === 'index.md' ? markdown : markdown.replace(/^# /m, `# ${name} / `);
        writeFileSync(path, '---\nprev: false\nnext: false\n---\n\n' + labelled);
      }
    }
  }
  annotate(resolve(out, name));
}
writeFileSync(
  resolve(out, 'index.md'),
  `# API reference\n\nPublic exports for Quilt **${version}**. These pages are generated from TypeScript.\n\n- [Vanilla](./quilt-vanilla/index.md): mounting, handles, registration, themes, and shared model exports.\n- [React](./quilt-react/index.md): components, hooks, and shared renderer APIs.\n- [Three.js](./quilt-three/index.md): shared-scene sessions and views.\n- [Three.js React](./quilt-three-react/index.md): R3F bindings.\n- [Three.js WebGPU](./quilt-three-webgpu/index.md): document-owned WebGPU renderer creation.\n- [Core](./quilt-core/index.md): the framework-independent layout model and commands.\n\nStart with the [quickstarts](../index.md) for a working integration, or [API concepts](../api.md) for behavior and constraints.\n`,
);
