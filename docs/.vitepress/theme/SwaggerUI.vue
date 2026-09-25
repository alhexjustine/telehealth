<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { withBase } from 'vitepress';

const container = ref<HTMLDivElement | null>(null);

onMounted(async () => {
  const [{ default: SwaggerUIBundle }, { default: SwaggerUIStandalonePreset }] = await Promise.all([
    import('swagger-ui'),
    import('swagger-ui/dist/swagger-ui-standalone-preset'),
    import('swagger-ui/dist/swagger-ui.css'),
  ]);

  if (!container.value) return;

  SwaggerUIBundle({
    url: withBase('/openapi.json'),
    domNode: container.value,
    presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
    layout: 'StandaloneLayout',
  });
});
</script>

<template>
  <div ref="container" class="swagger-ui-container" />
</template>
