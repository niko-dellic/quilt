import { defineConfig } from 'vitepress';
import { readFileSync } from 'node:fs';
const { version } = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
);
export default defineConfig({
  markdown: { theme: { light: 'github-light-high-contrast', dark: 'github-dark-high-contrast' } },
  title: 'Quilt',
  description: 'Split panes, tabs, and popout windows for your application.',
  base: '/',
  rewrites: (id) =>
    id === 'index.md' ? id : id === 'overview.md' ? 'docs/index.md' : `docs/${id}`,
  cleanUrls: true,
  // These pages are built by the separate demo application.
  ignoreDeadLinks: [/^\/(vanilla|react|electron)(\.html)?$/],
  appearance: true,
  outDir: '.vitepress/site',
  lastUpdated: true,
  srcExclude: ['deployment.md', 'desktop-release.md', 'packaging.md', 'releases.md'],
  head: [['link', { rel: 'icon', href: '/favicon.ico' }]],
  themeConfig: {
    outline: [2, 3],
    siteTitle: 'Quilt',
    logo: { src: '/android-chrome-192x192.png', alt: '', width: 24, height: 24 },
    logoLink: { link: '/', target: '_self' },
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Guide', link: '/docs/' },
      { text: 'API', link: '/docs/api-reference/' },
      { text: 'Demos', link: 'https://quilt-layouts.vercel.app/vanilla.html' },
    ],
    sidebar: [
      {
        text: 'Start here',
        items: [
          { text: 'Getting started', link: '/docs/' },
          { text: 'Vanilla', link: '/docs/quickstart-vanilla' },
          { text: 'React', link: '/docs/quickstart-react' },
          { text: 'Core concepts', link: '/docs/concepts' },
        ],
      },
      {
        text: 'Guides',
        items: [
          { text: 'Integration and persistence', link: '/docs/integration' },
          { text: 'Themes and tab bars', link: '/docs/theming' },
          { text: 'Pane and window lifecycle', link: '/docs/lifecycle' },
          { text: 'Examples', link: '/docs/examples' },
          { text: 'Compatibility', link: '/docs/compatibility' },
          { text: 'Troubleshooting', link: '/docs/troubleshooting' },
          { text: 'Migration', link: '/docs/migration' },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'API concepts', link: '/docs/api' },
          { text: 'Vanilla exports', link: '/docs/api-reference/quilt-vanilla/' },
          { text: 'React exports', link: '/docs/api-reference/quilt-react/' },
          { text: 'Core exports', link: '/docs/api-reference/quilt-core/' },
          {
            text: 'Contributing',
            link: 'https://github.com/niko-dellic/quilt/blob/main/CONTRIBUTING.md',
          },
        ],
      },
    ],
    search: { provider: 'local' },
    socialLinks: [{ icon: 'github', link: 'https://github.com/niko-dellic/quilt' }],
    footer: {
      message: `Documentation for released Quilt ${version}.`,
      copyright: 'MIT licensed · Quilt contributors',
    },
  },
});
