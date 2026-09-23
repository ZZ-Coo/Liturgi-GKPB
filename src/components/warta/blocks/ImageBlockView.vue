<script setup lang="ts">
import type { ImageBlock } from '@/lib/warta/types'
import '@/components/warta/warta-image.css'

// Renders nothing at all when there's no image yet — this only happens in
// the builder's own preview (a freshly-added block before upload finishes);
// a saved/published warta never has an empty url, since the editor only
// commits data.url once the upload has actually succeeded.
defineProps<{ block: ImageBlock }>()
</script>

<template>
  <figure v-if="block.data.url" class="warta-image-figure" :class="`w-${block.data.width}`">
    <img :src="block.data.url" :alt="block.data.alt || block.title || 'Gambar'" loading="lazy" />
    <figcaption v-if="block.data.caption" class="warta-image-caption">{{ block.data.caption }}</figcaption>
  </figure>
</template>
