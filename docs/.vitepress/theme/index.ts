import { defineComponent, h, nextTick, onMounted } from 'vue';
import DefaultTheme from 'vitepress/theme';
import '../../../demos/site-brand.css';
import './custom.css';

export default {
  extends: DefaultTheme,
  Layout: defineComponent({
    setup() {
      onMounted(async () => {
        const url = new URL(window.location.href);
        if (url.searchParams.get('search') !== '1') return;
        await nextTick();
        // Use the pinned theme's search button so homepage search opens the same
        // dialog and index as every guide/API page, without a second search service.
        const button = document.querySelector<HTMLButtonElement>('.VPNavBarSearchButton');
        if (button) {
          button.click();
          url.searchParams.delete('search');
          history.replaceState(history.state, '', url.pathname + url.search + url.hash);
        }
      });
      return () =>
        h(DefaultTheme.Layout, null, {
          'nav-bar-title-before': () =>
            h('img', {
              class: 'brand-icon',
              src: '/android-chrome-192x192.png',
              width: 29,
              height: 29,
              alt: '',
            }),
        });
    },
  }),
};
