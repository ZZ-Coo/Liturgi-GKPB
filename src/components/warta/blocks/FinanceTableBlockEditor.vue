<script setup lang="ts">
import { computed } from 'vue'
import TableGrid from '@/components/warta/TableGrid.vue'
import { formatAmount, parseAmount, sumColumn } from '@/lib/warta/money'
import type { FinanceColumn, FinanceTableData } from '@/lib/warta/types'

// v-model on the block's `data`, edited in place (see TableBlockEditor).
const data = defineModel<FinanceTableData>({ required: true })

const createColumn = (): FinanceColumn => ({ header: '', kind: 'amount' })
const cellClass = (ci: number) => (data.value.columns[ci]?.kind === 'amount' ? 'text-right tabular-nums' : '')
const cellInvalid = (ci: number, value: string) =>
  data.value.columns[ci]?.kind === 'amount' && parseAmount(value).kind === 'invalid'

// The live total row the published table will show.
const totals = computed(() =>
  data.value.columns.map((column, ci) => (column.kind === 'amount' ? sumColumn(data.value.rows, ci) : null)),
)
const invalidCount = computed(() => totals.value.reduce((sum, t) => sum + (t?.invalidCount ?? 0), 0))
</script>

<template>
  <div class="space-y-3">
    <label class="block space-y-1.5">
      <span class="label-eyebrow">Label baris total</span>
      <input v-model="data.totalLabel" class="input" placeholder="mis. JUMLAH PENERIMAAN — kosongkan kalau tidak perlu total" />
    </label>

    <TableGrid :columns="data.columns" :rows="data.rows" :create-column="createColumn" :cell-class="cellClass" :cell-invalid="cellInvalid">
      <template #column-tools="{ column }">
        <select v-model="column.kind" class="rounded-md border border-line bg-surface px-1.5 py-1 text-xs text-ink focus:border-accent focus:outline-none" aria-label="Jenis kolom">
          <option value="text">Teks</option>
          <option value="amount">Nominal</option>
        </select>
      </template>

      <template #footer="{ leading }">
        <tr v-if="data.totalLabel.trim()" class="border-t border-line bg-paper-deep/60 text-xs font-semibold text-ink">
          <td :colspan="leading" />
          <td v-for="(column, ci) in data.columns" :key="ci" class="px-2.5 py-2" :class="column.kind === 'amount' ? 'text-right tabular-nums' : ''">
            <template v-if="ci === 0">{{ data.totalLabel }}</template>
            <template v-else-if="column.kind === 'amount'">{{ totals[ci]?.total == null ? '-' : formatAmount(totals[ci]!.total!) }}</template>
          </td>
          <td />
        </tr>
      </template>
    </TableGrid>

    <p class="text-xs text-muted">
      Ketik nominal seperti <code>1.500.000</code> (titik = ribuan); <code>-</code> atau kosong = tidak ada. Total dihitung otomatis dari kolom Nominal.
    </p>
    <p v-if="invalidCount" class="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">
      {{ invalidCount }} sel Nominal tidak terbaca (ditandai merah) dan tidak ikut dijumlahkan.
    </p>
  </div>
</template>
