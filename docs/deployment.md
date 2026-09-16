# Demo deployment

Vercel deploys the Vite demonstration site from the repository root. The checked-in
`vercel.json` installs with `npm ci`, builds the workspace packages, then builds the
site into `dist`. `npm run build` alone only compiles the library packages and does
not produce the website.

To reproduce the deployment build locally:

```sh
npm ci
npm run build && npm run build:demos
```

The output includes `index.html`, `vanilla.html`, `react.html`, and `electron.html`,
with their bundled assets. The Electron page links to binaries hosted in GitHub
Releases; the site build does not create them. Keep the Vercel project root at the repository root and use Node 24 in its
project settings. Git pull requests create previews; merging to `main` updates the
production site. This deployment does not publish npm packages.

## Documentation site

`npm run build:site` builds the demos and the VitePress site into `dist/docs`.
The Vercel build runs it after the package build. Run `npm run docs:dev` for local
editing, or `npm run docs:build && npm run docs:test` for generated references,
link/anchor checks, and type-checked quickstarts. `npm run check` includes these checks.

Guides live in `docs/*.md`; contributor release/deployment instructions remain on
GitHub and are excluded from the published navigation. TypeDoc generates
`docs/api-reference` from public package entry points. Do not edit generated files.
The private `quilt-docs` tooling workspace uses its own TypeScript 6 compiler for
TypeDoc compatibility; package builds continue using TypeScript 7.

The docs version follows the root package version. Publish public API documentation
with the corresponding release; use preview deployments to review unreleased changes.
Public API source links point at the matching release tag.
