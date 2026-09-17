import { defineComponent, h } from 'vue';
import DefaultTheme from 'vitepress/theme';
import '../../../demos/site-brand.css';
import './custom.css';

export default {
  extends: DefaultTheme,
  Layout: defineComponent({
    setup() {
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
