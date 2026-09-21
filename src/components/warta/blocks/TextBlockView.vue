<script setup lang="ts">
import type { TextBlock } from '@/lib/warta/types'
import RichTextView from '@/components/warta/RichTextView.vue'

defineProps<{ block: TextBlock }>()
</script>

<template>
  <RichTextView :doc="block.data.content" />
</template>
