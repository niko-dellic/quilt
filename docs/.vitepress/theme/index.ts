import DefaultTheme from 'vitepress/theme';
import type { Theme } from 'vitepress';
import Layout from './Layout.vue';
import '@nikodellic/publisher-docs/style.css';
export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ router }) {
    // Demo content has its own runtime outside the documentation app. Navigation
    // must unload that runtime before loading a different page.
    router.onBeforeRouteChange = (to) => {
      if (typeof window !== 'undefined' && router.route.data.frontmatter.navbarOnly) {
        window.location.assign(to);
        return false;
      }
    };
  },
} satisfies Theme;
