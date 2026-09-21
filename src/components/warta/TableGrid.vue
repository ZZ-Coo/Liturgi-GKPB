<script setup lang="ts" generic="C extends { header: string }">
import { toRaw } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { GripVertical, X, Plus } from 'lucide-vue-next'
import { newId } from '@/lib/warta/id'

// The spreadsheet-like grid shared by the table editors: a header row of
// column titles, one row of inputs per table row, rows draggable by their
// handle, add/remove for rows and columns. What a column *is* (alignment for
// a plain table, text/amount for a finance table) is up to the caller, via the
// `column-tools` slot and `createColumn`.
//
// `columns` and `rows` are edited IN PLACE — they belong to the parent's
// reactive block data, which watches them for "unsaved changes".
const props = defineProps<{
  columns: C[]
  rows: string[][]
  createColumn: () => C
  numbered?: boolean
  /** extra classes for the inputs of one column (e.g. right-align amounts) */
  cellClass?: (columnIndex: number) => string
  /** true = mark the cell as invalid */
  cellInvalid?: (columnIndex: number, value: string) => boolean
}>()

// Table rows are plain string arrays with no id of their own, but dragging
// needs a stable key per row. Remember one per (raw) row array.
const rowKeys = new WeakMap<object, string>()
function rowKey(row: string[]): string {
  const raw = toRaw(row)
  let key = rowKeys.get(raw)
  if (!key) {
    key = newId()
    rowKeys.set(raw, key)
  }
  return key
}

function addRow() {
  props.rows.push(props.columns.map(() => ''))
}
function removeRow(index: number) {
  if (props.rows.length > 1) props.rows.splice(index, 1)
}
function addColumn() {
  props.columns.push(props.createColumn())
  props.rows.forEach((row) => row.push(''))
}
function removeColumn(index: number) {
  if (props.columns.length <= 1) return
  props.columns.splice(index, 1)
  props.rows.forEach((row) => row.splice(index, 1))
}
function reorder(next: string[][]) {
  props.rows.splice(0, props.rows.length, ...next)
}

// Grow the textarea with its content (multi-line cells: a list of names,
// a long activity description) instead of scrolling inside a tiny box.
function fit(el: HTMLTextAreaElement) {
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}
const vAutosize = { mounted: fit, updated: fit }
</script>

<template>
  <div class="space-y-2">
    <div class="overflow-x-auto rounded-xl border border-line">
      <table class="w-full border-collapse text-sm">
        <thead>
          <tr class="bg-paper-deep/60 align-top">
            <th class="w-8" />
            <th v-if="numbered" class="w-10 px-1 pt-3 text-center text-xs font-medium text-muted">No</th>
            <th v-for="(column, ci) in columns" :key="ci" class="min-w-[9rem] p-1.5 text-left align-top font-normal">
              <div class="space-y-1.5">
                <input v-model="column.header" class="input !py-1.5 text-xs font-semibold" placeholder="Judul kolom" />
                <div class="flex items-center justify-between gap-1">
                  <slot name="column-tools" :column="column" :index="ci" />
                  <button
                    type="button"
                    class="rounded-md p-1 text-muted transition-colors hover:bg-danger/10 hover:text-danger disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted"
                    :disabled="columns.length <= 1"
                    title="Hapus kolom"
                    aria-label="Hapus kolom"
                    @click="removeColumn(ci)"
                  >
                    <X class="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </th>
            <th class="w-8" />
          </tr>
        </thead>

        <VueDraggable
          tag="tbody"
          :model-value="rows"
          handle=".row-handle"
          :animation="150"
          ghost-class="opacity-40"
          @update:model-value="reorder"
        >
          <tr v-for="(row, ri) in rows" :key="rowKey(row)" class="border-t border-line">
            <td class="px-1 pt-2 align-top">
              <button type="button" class="row-handle cursor-grab touch-none rounded-md p-1 text-muted hover:bg-accent-soft hover:text-accent active:cursor-grabbing" title="Geser baris" aria-label="Geser baris">
                <GripVertical class="h-4 w-4" />
              </button>
            </td>
            <td v-if="numbered" class="pt-3 text-center align-top text-xs text-muted">{{ ri + 1 }}</td>
            <td v-for="(column, ci) in columns" :key="ci" class="p-1 align-top">
              <textarea
                v-model="row[ci]"
                v-autosize
                rows="1"
                class="input min-h-[2rem] resize-none !py-1.5 text-xs leading-snug"
                :class="[cellClass?.(ci), cellInvalid?.(ci, row[ci]) ? '!border-danger ring-1 ring-danger/40' : '']"
              />
            </td>
            <td class="px-1 pt-2 align-top">
              <button
                type="button"
                class="rounded-md p-1 text-muted transition-colors hover:bg-danger/10 hover:text-danger disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted"
                :disabled="rows.length <= 1"
                title="Hapus baris"
                aria-label="Hapus baris"
                @click="removeRow(ri)"
              >
                <X class="h-3.5 w-3.5" />
              </button>
            </td>
          </tr>
        </VueDraggable>

        <tfoot>
          <slot name="footer" :leading="numbered ? 2 : 1" />
        </tfoot>
      </table>
    </div>

    <div class="flex flex-wrap gap-2">
      <button type="button" class="btn gap-1.5 !py-1.5 text-xs" @click="addRow"><Plus class="h-3.5 w-3.5" /> Baris</button>
      <button type="button" class="btn gap-1.5 !py-1.5 text-xs" @click="addColumn"><Plus class="h-3.5 w-3.5" /> Kolom</button>
    </div>
  </div>
</template>
