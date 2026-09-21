<script setup lang="ts">
import { watch } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { Bold, Italic, Underline, ListOrdered } from 'lucide-vue-next'
import type { RichDoc } from '@/lib/warta/types'
// Same typography as the published page.
import '@/components/warta/warta-rich.css'

// The only place TipTap is imported. Deliberately trimmed to what a warta
// needs — paragraphs, bold/italic/underline, numbered lists — so the editor
// can't produce anything the public renderer (lib/warta/richtext.ts) would
// have to ignore. Pulled in lazily, only inside the admin.
const props = defineProps<{ modelValue: RichDoc }>()
const emit = defineEmits<{ 'update:modelValue': [value: RichDoc] }>()

const editor = useEditor({
  content: props.modelValue,
  extensions: [
    StarterKit.configure({
      heading: false,
      blockquote: false,
      bulletList: false,
      code: false,
      codeBlock: false,
      horizontalRule: false,
      strike: false,
      link: false,
      // v3 keeps an empty paragraph after a trailing list; the numbered list
      // is exited with Enter on an empty item instead, and nothing stray
      // ends up in the saved document.
      trailingNode: false,
    }),
  ],
  editorProps: {
    attributes: {
      class: 'min-h-[5rem] px-3 py-2.5 text-sm text-ink focus:outline-none',
    },
  },
  onUpdate: ({ editor }) => {
    emit('update:modelValue', editor.getJSON() as RichDoc)
  },
})

// Content changed from outside (e.g. "reset ke contoh", duplicating last
// week's warta) — push it into the editor without echoing an update back.
watch(
  () => props.modelValue,
  (value) => {
    const current = editor.value
    if (!current) return
    if (JSON.stringify(current.getJSON()) === JSON.stringify(value)) return
    current.commands.setContent(value, { emitUpdate: false })
  },
)

const tools = [
  { name: 'bold', label: 'Tebal (Ctrl+B)', icon: Bold, run: () => editor.value?.chain().focus().toggleBold().run() },
  { name: 'italic', label: 'Miring (Ctrl+I)', icon: Italic, run: () => editor.value?.chain().focus().toggleItalic().run() },
  { name: 'underline', label: 'Garis bawah (Ctrl+U)', icon: Underline, run: () => editor.value?.chain().focus().toggleUnderline().run() },
  { name: 'orderedList', label: 'Daftar bernomor', icon: ListOrdered, run: () => editor.value?.chain().focus().toggleOrderedList().run() },
]
</script>

<template>
  <div class="overflow-hidden rounded-xl border border-line bg-surface focus-within:border-accent-line">
    <div class="flex items-center gap-0.5 border-b border-line bg-paper px-1.5 py-1">
      <button
        v-for="tool in tools"
        :key="tool.name"
        type="button"
        :title="tool.label"
        :aria-label="tool.label"
        class="rounded-md p-1.5 text-muted transition-colors hover:bg-accent-soft hover:text-accent"
        :class="editor?.isActive(tool.name) ? 'bg-accent-soft text-accent' : ''"
        @mousedown.prevent
        @click="tool.run()"
      >
        <component :is="tool.icon" class="h-4 w-4" />
      </button>
    </div>
    <EditorContent :editor="editor" class="warta-editor" />
  </div>
</template>
