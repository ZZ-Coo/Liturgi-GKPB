<script setup lang="ts">
import { VueDraggable } from 'vue-draggable-plus'
import { GripVertical, Trash2, Plus } from 'lucide-vue-next'
import { blockRegistry, blockDefinitions, createBlock } from '@/lib/warta/blocks'
import { newId } from '@/lib/warta/id'
import { askConfirm } from '@/composables/confirm'
import type { WartaBlockType, WartaSection } from '@/lib/warta/types'

// The editing surface: sections you can reorder, each holding blocks you can
// reorder — and move between sections. Edits the array IN PLACE (the parent
// owns it and watches it deeply for "unsaved changes"); only structural
// replacement goes through the model.
//
// Dragging only starts from the grip handles, never from the editors
// themselves, so selecting text inside a block can't turn into a drag.
const sections = defineModel<WartaSection[]>({ required: true })

function addSection() {
  sections.value.push({ id: newId(), title: 'Bagian baru', numbering: 'roman', blocks: [] })
}

async function removeSection(index: number) {
  const section = sections.value[index]
  if (section.blocks.length) {
    const ok = await askConfirm({
      title: `Hapus bagian "${section.title || 'tanpa judul'}"?`,
      message: `${section.blocks.length} butir di dalamnya ikut terhapus. Belum tersimpan, jadi bisa dibatalkan dengan memuat ulang halaman tanpa menyimpan.`,
      confirmLabel: 'Hapus bagian',
      tone: 'danger',
    })
    if (!ok) return
  }
  sections.value.splice(index, 1)
}

function addBlock(section: WartaSection, type: WartaBlockType) {
  section.blocks.push(createBlock(type))
}

// Ready-made starting points, listed per block type: "Tabel → Warga berulang
// tahun", "Tabel keuangan → Laporan: penerimaan", …
const presetGroups = blockDefinitions.filter((def) => def.presets.length)

function addPreset(section: WartaSection, event: Event) {
  const select = event.target as HTMLSelectElement
  const [type, key] = select.value.split(':') as [WartaBlockType, string]
  select.value = '' // back to the placeholder, ready for the next pick
  const preset = blockRegistry[type]?.presets.find((p) => p.key === key)
  if (preset) section.blocks.push(createBlock(type, preset.title, preset.createData()))
}

function removeBlock(section: WartaSection, index: number) {
  section.blocks.splice(index, 1)
}
</script>

<template>
  <div class="space-y-4">
    <VueDraggable
      v-model="sections"
      handle=".section-handle"
      :animation="160"
      ghost-class="opacity-40"
      class="space-y-4"
    >
      <div v-for="(section, si) in sections" :key="section.id" class="field-group">
        <div class="flex items-center gap-2">
          <button type="button" class="section-handle cursor-grab touch-none rounded-md p-1 text-muted hover:bg-accent-soft hover:text-accent active:cursor-grabbing" title="Geser bagian" aria-label="Geser bagian">
            <GripVertical class="h-4 w-4" />
          </button>
          <select v-model="section.numbering" class="input !w-auto shrink-0 !py-2" aria-label="Penomoran bagian">
            <option value="roman">I, II, III</option>
            <option value="none">Tanpa nomor</option>
          </select>
          <input v-model="section.title" class="input" placeholder="Judul bagian" />
          <button type="button" class="btn-danger px-2.5" title="Hapus bagian" @click="removeSection(si)">
            <Trash2 class="h-4 w-4" />
          </button>
        </div>

        <!-- same `group` on every block list = blocks can be dragged between sections -->
        <VueDraggable
          v-model="section.blocks"
          group="warta-blocks"
          handle=".block-handle"
          :animation="160"
          ghost-class="opacity-40"
          class="min-h-[2.5rem] space-y-2 rounded-xl"
        >
          <div v-for="(block, bi) in section.blocks" :key="block.id" class="space-y-2 rounded-xl border border-line bg-paper p-3">
            <div class="flex items-center gap-2">
              <button type="button" class="block-handle cursor-grab touch-none rounded-md p-1 text-muted hover:bg-accent-soft hover:text-accent active:cursor-grabbing" title="Geser butir" aria-label="Geser butir">
                <GripVertical class="h-4 w-4" />
              </button>
              <span class="chip bg-accent-soft text-accent">{{ blockRegistry[block.type].label }}</span>
              <input v-model="block.title" class="input" placeholder="Judul butir (kosong = tanpa nomor)" />
              <button type="button" class="btn-danger px-2.5" title="Hapus butir" @click="removeBlock(section, bi)">
                <Trash2 class="h-4 w-4" />
              </button>
            </div>
            <component :is="blockRegistry[block.type].Editor" v-model="block.data" />
          </div>
        </VueDraggable>

        <p v-if="!section.blocks.length" class="text-center text-xs text-muted">Belum ada butir. Tambahkan di bawah, atau geser dari bagian lain.</p>

        <div class="flex flex-wrap items-center gap-2">
          <button
            v-for="def in blockDefinitions"
            :key="def.type"
            type="button"
            class="btn gap-1.5 !py-1.5 text-xs"
            @click="addBlock(section, def.type)"
          >
            <component :is="def.icon" class="h-3.5 w-3.5" /> {{ def.label }}
          </button>

          <select
            class="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-accent-line focus:border-accent focus:outline-none"
            aria-label="Tambah dari templat"
            @change="addPreset(section, $event)"
          >
            <option value="">＋ Dari templat…</option>
            <optgroup v-for="def in presetGroups" :key="def.type" :label="def.label">
              <option v-for="preset in def.presets" :key="preset.key" :value="`${def.type}:${preset.key}`">{{ preset.label }}</option>
            </optgroup>
          </select>
        </div>
      </div>
    </VueDraggable>

    <button type="button" class="btn w-full gap-1.5" @click="addSection">
      <Plus class="h-4 w-4" /> Tambah bagian
    </button>
  </div>
</template>
