<script setup lang="ts">
import { AlignLeft, AlignCenter, AlignRight } from 'lucide-vue-next'
import TableGrid from '@/components/warta/TableGrid.vue'
import type { ColumnAlign, TableColumn, TableData } from '@/lib/warta/types'

// Block editor contract (lib/warta/blocks/index.ts): v-model on the block's
// `data`. The table is edited in place — the parent owns the reactive object.
const data = defineModel<TableData>({ required: true })

const ALIGNS: { value: ColumnAlign; label: string; icon: typeof AlignLeft }[] = [
  { value: 'left', label: 'Rata kiri', icon: AlignLeft },
  { value: 'center', label: 'Rata tengah', icon: AlignCenter },
  { value: 'right', label: 'Rata kanan', icon: AlignRight },
]
const createColumn = (): TableColumn => ({ header: '', align: 'left' })
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-ink">
      <label class="inline-flex cursor-pointer items-center gap-2">
        <input v-model="data.showHeader" type="checkbox" class="accent-[rgb(var(--color-accent))]" /> Baris judul kolom
      </label>
      <label class="inline-flex cursor-pointer items-center gap-2">
        <input v-model="data.bordered" type="checkbox" class="accent-[rgb(var(--color-accent))]" /> Garis tabel
      </label>
      <label class="inline-flex cursor-pointer items-center gap-2">
        <input v-model="data.numbered" type="checkbox" class="accent-[rgb(var(--color-accent))]" /> Nomor otomatis
      </label>
    </div>

    <TableGrid :columns="data.columns" :rows="data.rows" :numbered="data.numbered" :create-column="createColumn">
      <template #column-tools="{ column }">
        <div class="inline-flex rounded-md border border-line bg-surface p-0.5">
          <button
            v-for="align in ALIGNS"
            :key="align.value"
            type="button"
            class="rounded p-1 transition-colors"
            :class="column.align === align.value ? 'bg-accent-soft text-accent' : 'text-muted hover:text-ink'"
            :title="align.label"
            :aria-label="align.label"
            @click="column.align = align.value"
          >
            <component :is="align.icon" class="h-3.5 w-3.5" />
          </button>
        </div>
      </template>
    </TableGrid>

    <p class="text-xs text-muted">Tebal: <code>**teks**</code> · miring: <code>*teks*</code> · Enter di dalam kotak = baris baru.</p>
  </div>
</template>
