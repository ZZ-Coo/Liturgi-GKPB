<script setup lang="ts">
import { computed } from 'vue'
import type { RichDoc } from '@/lib/warta/types'
import { richToHtml } from '@/lib/warta/richtext'
import '@/components/warta/warta-rich.css'

// Read-only rich text. richToHtml only ever emits a fixed set of tags with
// escaped text (see lib/warta/richtext.ts), which is what makes v-html safe.
const props = defineProps<{ doc: RichDoc }>()
const html = computed(() => richToHtml(props.doc))
</script>

<template>
  <div class="warta-rich" v-html="html" />
</template>
