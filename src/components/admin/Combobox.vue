<script setup lang="ts">
// A searchable single-select — same look as `.input`/`<select>` elsewhere
// in the admin, but with a filterable list instead of native <option>
// scrolling. Built for lists long enough that scanning them is the
// bottleneck (jemaat: ~86, pendeta: ~37) — for a handful of options a
// plain <select> is still the right call.
import { ref, computed, nextTick, onBeforeUnmount } from 'vue'
import { Search, ChevronDown, Check } from 'lucide-vue-next'

export interface ComboboxOption {
  id: string
  label: string
  sublabel?: string
}

const props = withDefaults(
  defineProps<{
    modelValue: string
    options: ComboboxOption[]
    placeholder?: string
    searchPlaceholder?: string
    disabled?: boolean
    emptyText?: string
  }>(),
  {
    placeholder: 'Pilih…',
    searchPlaceholder: 'Cari…',
    disabled: false,
    emptyText: 'Gak ada yang cocok.',
  },
)

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const open = ref(false)
const query = ref('')
const activeIndex = ref(0)
const rootEl = ref<HTMLElement | null>(null)
const searchInputEl = ref<HTMLInputElement | null>(null)

const selected = computed(() => props.options.find((o) => o.id === props.modelValue) ?? null)

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return props.options
  return props.options.filter(
    (o) => o.label.toLowerCase().includes(q) || o.sublabel?.toLowerCase().includes(q),
  )
})

function openPanel() {
  if (props.disabled) return
  open.value = true
  query.value = ''
  activeIndex.value = Math.max(
    0,
    filtered.value.findIndex((o) => o.id === props.modelValue),
  )
  nextTick(() => searchInputEl.value?.focus())
}

function closePanel() {
  open.value = false
}

function choose(option: ComboboxOption) {
  emit('update:modelValue', option.id)
  closePanel()
}

function onKeydown(e: KeyboardEvent) {
  if (!open.value) {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault()
      openPanel()
    }
    return
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    activeIndex.value = Math.min(activeIndex.value + 1, filtered.value.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    activeIndex.value = Math.max(activeIndex.value - 1, 0)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const picked = filtered.value[activeIndex.value]
    if (picked) choose(picked)
  } else if (e.key === 'Escape') {
    e.preventDefault()
    closePanel()
  }
}

// Reset the highlighted row whenever the filtered list changes, so
// arrow-key nav doesn't start from a stale/out-of-range index.
function onQueryInput() {
  activeIndex.value = 0
}

function onClickOutside(e: MouseEvent) {
  if (open.value && rootEl.value && !rootEl.value.contains(e.target as Node)) closePanel()
}
document.addEventListener('mousedown', onClickOutside)
onBeforeUnmount(() => document.removeEventListener('mousedown', onClickOutside))
</script>

<template>
  <div ref="rootEl" class="relative">
    <button
      type="button"
      class="input flex items-center justify-between gap-2 pr-3 text-left"
      :class="!selected && 'text-muted/70'"
      :disabled="disabled"
      @click="open ? closePanel() : openPanel()"
      @keydown="onKeydown"
    >
      <span class="truncate">{{ selected ? selected.label : placeholder }}</span>
      <ChevronDown class="h-3.5 w-3.5 shrink-0 text-muted transition-transform" :class="open && 'rotate-180'" />
    </button>

    <div
      v-if="open"
      class="card absolute z-20 mt-1.5 w-full overflow-hidden p-0 shadow-card"
      @keydown="onKeydown"
    >
      <div class="relative border-b border-line">
        <Search class="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
        <input
          ref="searchInputEl"
          v-model="query"
          type="text"
          :placeholder="searchPlaceholder"
          class="w-full border-0 bg-transparent py-2.5 pl-9 pr-3 text-sm text-ink placeholder:text-muted/70 focus:outline-none focus:ring-0"
          @input="onQueryInput"
        />
      </div>

      <ul class="max-h-56 overflow-y-auto py-1">
        <li v-if="!filtered.length" class="px-3.5 py-2.5 text-sm text-muted">{{ emptyText }}</li>
        <li
          v-for="(o, i) in filtered"
          :key="o.id"
          class="flex cursor-pointer items-center justify-between gap-2 px-3.5 py-2 text-sm transition-colors"
          :class="[
            i === activeIndex ? 'bg-accent-soft text-accent' : 'text-ink hover:bg-paper-deep/70',
          ]"
          @mouseenter="activeIndex = i"
          @mousedown.prevent="choose(o)"
        >
          <span class="truncate">
            {{ o.label }}
            <span v-if="o.sublabel" class="text-muted">— {{ o.sublabel }}</span>
          </span>
          <Check v-if="o.id === modelValue" class="h-3.5 w-3.5 shrink-0" />
        </li>
      </ul>
    </div>
  </div>
</template>
