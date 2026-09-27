<script setup lang="ts">
import DefaultTheme from 'vitepress/theme';
import { useData } from 'vitepress';
import VPNav from 'vitepress/dist/client/theme-default/components/VPNav.vue';
import VPSkipLink from 'vitepress/dist/client/theme-default/components/VPSkipLink.vue';
const { frontmatter } = useData();
</script>

<template>
  <div v-if="frontmatter.navbarOnly" class="quilt-site-navbar">
    <VPSkipLink />
    <VPNav />
  </div>
  <DefaultTheme.Layout v-else />
</template>

<style>
body.demo-page > #app,
body.electron-page > #app {
  flex-shrink: 0;
  height: var(--vp-nav-height);
}
.quilt-site-navbar {
  height: var(--vp-nav-height);
}
body.demo-page,
body.electron-page {
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
}
</style>
