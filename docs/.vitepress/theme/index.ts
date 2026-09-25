import DefaultTheme from 'vitepress/theme';
import SwaggerUI from './SwaggerUI.vue';
import type { Theme } from 'vitepress';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('SwaggerUI', SwaggerUI);
  },
} satisfies Theme;
