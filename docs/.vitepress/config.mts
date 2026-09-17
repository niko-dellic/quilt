import { defineConfig } from 'vitepress';
import { readFileSync } from 'node:fs';
const { version } = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
);
export default defineConfig({
  title: 'Quilt',
  description: 'Split panes, tabs, and popout windows for your application.',
  base: '/docs/',
  cleanUrls: true,
  outDir: '../dist/docs',
  lastUpdated: true,
  srcExclude: ['deployment.md', 'desktop-release.md', 'packaging.md', 'releases.md'],
  head: [['link', { rel: 'icon', href: '/favicon.ico' }]],
  themeConfig: {
    outline: [2, 3],
    siteTitle: `Quilt ${version}`,
    nav: [
      { text: 'Guide', link: '/getting-started' },
      { text: 'API', link: '/api-reference/' },
      { text: 'Demos', link: 'https://quilt-layouts.vercel.app/vanilla.html' },
    ],
    sidebar: [
      {
        text: 'Start here',
        items: [
          { text: 'Introduction', link: '/' },
          { text: 'Getting started', link: '/getting-started' },
          { text: 'Vanilla', link: '/quickstart-vanilla' },
          { text: 'React', link: '/quickstart-react' },
          { text: 'Core concepts', link: '/concepts' },
        ],
      },
      {
        text: 'Guides',
        items: [
          { text: 'Integration and persistence', link: '/integration' },
          { text: 'Themes and tab bars', link: '/theming' },
          { text: 'Pane and window lifecycle', link: '/lifecycle' },
          { text: 'Examples', link: '/examples' },
          { text: 'Compatibility', link: '/compatibility' },
          { text: 'Troubleshooting', link: '/troubleshooting' },
          { text: 'Migration', link: '/migration' },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'API concepts', link: '/api' },
          { text: 'Vanilla exports', link: '/api-reference/quilt-vanilla/' },
          { text: 'React exports', link: '/api-reference/quilt-react/' },
          { text: 'Core exports', link: '/api-reference/quilt-core/' },
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
