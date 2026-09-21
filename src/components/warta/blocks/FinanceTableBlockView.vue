<script setup lang="ts">
import { computed } from 'vue'
import type { FinanceTableBlock } from '@/lib/warta/types'
import { inlineToHtml } from '@/lib/warta/inline'
import { displayAmount, formatAmount, parseAmount, sumColumn } from '@/lib/warta/money'
import '@/components/warta/warta-table.css'

const props = defineProps<{ block: FinanceTableBlock }>()

const totals = computed(() =>
  props.block.data.columns.map((column, ci) => (column.kind === 'amount' ? sumColumn(props.block.data.rows, ci) : null)),
)
const showTotal = computed(() => props.block.data.totalLabel.trim() !== '' && totals.value.some(Boolean))
const firstAmountColumn = computed(() => props.block.data.columns.findIndex((c) => c.kind === 'amount'))
</script>

<template>
  <div class="warta-table-wrap">
    <table class="warta-table is-bordered is-finance">
      <thead>
        <tr>
          <th
            v-for="(column, ci) in block.data.columns"
            :key="ci"
            v-html="inlineToHtml(column.header)"
          />
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, ri) in block.data.rows" :key="ri">
          <template v-for="(column, ci) in block.data.columns" :key="ci">
            <td v-if="column.kind === 'amount'" class="align-right" :class="{ 'is-invalid': parseAmount(row[ci]).kind === 'invalid' }">
              {{ displayAmount(row[ci]) }}
            </td>
            <td v-else class="align-left" v-html="inlineToHtml(row[ci])" />
          </template>
        </tr>
      </tbody>
      <tfoot v-if="showTotal">
        <tr>
          <!-- the label spans every column before the first amount column -->
          <td :colspan="Math.max(firstAmountColumn, 1)" class="align-center">{{ block.data.totalLabel }}</td>
          <template v-for="(column, ci) in block.data.columns" :key="ci">
            <td v-if="ci >= Math.max(firstAmountColumn, 1)" class="align-right">
              <template v-if="column.kind === 'amount'">{{ totals[ci]?.total == null ? '-' : formatAmount(totals[ci]!.total!) }}</template>
            </td>
          </template>
        </tr>
      </tfoot>
    </table>
  </div>
</template>
