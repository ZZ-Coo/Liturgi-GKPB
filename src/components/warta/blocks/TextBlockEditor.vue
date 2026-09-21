<script setup lang="ts">
import type { TextBlock } from '@/lib/warta/types'
import RichTextEditor from '@/components/warta/RichTextEditor.vue'

// Block editor contract (see lib/warta/blocks/index.ts): receives the block's
// `data`, emits the whole updated `data`. The block's title, ordering and
// delete/move controls belong to the surrounding builder, not to each block.
const props = defineProps<{ modelValue: TextBlock['data'] }>()
const emit = defineEmits<{ 'update:modelValue': [value: TextBlock['data']] }>()
</script>

<template>
  <RichTextEditor
    :model-value="props.modelValue.content"
    @update:model-value="emit('update:modelValue', { ...props.modelValue, content: $event })"
  />
</template>
