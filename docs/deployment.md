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

The output includes `index.html`, `vanilla.html`, `react.html`, `electron.html`, and `themes.html`,
with their bundled assets. The Electron page links to binaries hosted in GitHub
Releases; the site build does not create them. Keep the Vercel project root at the repository root and use Node 24 in its
project settings. Git pull requests create previews; merging to `main` updates the
production site. This deployment does not publish npm packages.
