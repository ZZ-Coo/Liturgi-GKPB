<script setup lang="ts">
import type { TableBlock } from '@/lib/warta/types'
import { inlineToHtml } from '@/lib/warta/inline'
import '@/components/warta/warta-table.css'

// Every string that reaches v-html goes through inlineToHtml (escape first,
// then **bold** / *italic* / line breaks) — see lib/warta/inline.ts.
defineProps<{ block: TableBlock }>()
</script>

<template>
  <div class="warta-table-wrap">
    <table class="warta-table" :class="{ 'is-bordered': block.data.bordered }">
      <thead v-if="block.data.showHeader">
        <tr>
          <th v-if="block.data.numbered" class="col-no">No</th>
          <th v-for="(column, ci) in block.data.columns" :key="ci" v-html="inlineToHtml(column.header)" />
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, ri) in block.data.rows" :key="ri">
          <td v-if="block.data.numbered" class="col-no">{{ ri + 1 }}</td>
          <td
            v-for="(column, ci) in block.data.columns"
            :key="ci"
            :class="`align-${column.align}`"
            v-html="inlineToHtml(row[ci])"
          />
        </tr>
      </tbody>
    </table>
  </div>
</template>
