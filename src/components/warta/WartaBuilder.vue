<script setup lang="ts">
import { computed, reactive } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { GripVertical, Trash2, Plus, ChevronRight, ChevronsDownUp, ChevronsUpDown } from 'lucide-vue-next'
import { blockRegistry, blockDefinitions, createBlock } from '@/lib/warta/blocks'
import { newId } from '@/lib/warta/id'
import { askConfirm } from '@/composables/confirm'
import { simplifiedView } from '@/composables/adminViewMode'
import type { WartaBlock, WartaBlockType, WartaSection } from '@/lib/warta/types'

// The editing surface: sections you can reorder, each holding blocks you can
// reorder — and move between sections. Edits the array IN PLACE (the parent
// owns it and watches it deeply for "unsaved changes"); only structural
// replacement goes through the model.
//
// Dragging only starts from the grip handles, never from the editors
// themselves, so selecting text inside a block can't turn into a drag.
const sections = defineModel<WartaSection[]>({ required: true })

// Same Simpel toggle as the rest of admin. In compact mode: block bodies
// collapse to just their header row, and labels shrink to icon-only
// (title/aria-label carry the text for a11y). Normal mode ignores all of
// this and always shows everything expanded, same as before.
const compact = computed(() => simplifiedView.value)

// Which blocks are expanded, by id. Only consulted in compact mode — a
// block not in this set is collapsed. Newly added blocks are added here
// immediately (see addBlock/addPreset) so you can fill them in right away
// instead of having to un-collapse what you just created.
const expandedBlockIds = reactive(new Set<string>())

function isBlockCollapsed(block: WartaBlock) {
  return compact.value && !expandedBlockIds.has(block.id)
}

function toggleBlock(block: WartaBlock) {
  if (expandedBlockIds.has(block.id)) expandedBlockIds.delete(block.id)
  else expandedBlockIds.add(block.id)
}

// Section-level bulk toggle, only worth showing once a section holds more
// than one block. "Collapsed" for the section = none of its blocks are
// individually expanded.
function isSectionCollapsed(section: WartaSection) {
  return section.blocks.every((b) => isBlockCollapsed(b))
}

function toggleSection(section: WartaSection) {
  if (isSectionCollapsed(section)) section.blocks.forEach((b) => expandedBlockIds.add(b.id))
  else section.blocks.forEach((b) => expandedBlockIds.delete(b.id))
}

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
  const block = createBlock(type)
  section.blocks.push(block)
  expandedBlockIds.add(block.id) // open right away, even if the rest of the section is collapsed
}

// Ready-made starting points, listed per block type: "Tabel → Warga berulang
// tahun", "Tabel keuangan → Laporan: penerimaan", …
const presetGroups = blockDefinitions.filter((def) => def.presets.length)

function addPreset(section: WartaSection, event: Event) {
  const select = event.target as HTMLSelectElement
  const [type, key] = select.value.split(':') as [WartaBlockType, string]
  select.value = '' // back to the placeholder, ready for the next pick
  const preset = blockRegistry[type]?.presets.find((p) => p.key === key)
  if (!preset) return
  const block = createBlock(type, preset.title, preset.createData())
  section.blocks.push(block)
  expandedBlockIds.add(block.id)
}

function removeBlock(section: WartaSection, index: number) {
  const [removed] = section.blocks.splice(index, 1)
  if (removed) expandedBlockIds.delete(removed.id)
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
          <button
            v-if="compact && section.blocks.length > 1"
            type="button"
            class="rounded-md p-1.5 text-muted hover:bg-accent-soft hover:text-accent"
            :title="isSectionCollapsed(section) ? 'Buka semua butir' : 'Tutup semua butir'"
            :aria-label="isSectionCollapsed(section) ? 'Buka semua butir' : 'Tutup semua butir'"
            @click="toggleSection(section)"
          >
            <component :is="isSectionCollapsed(section) ? ChevronsUpDown : ChevronsDownUp" class="h-4 w-4" />
          </button>
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
              <button
                v-if="compact"
                type="button"
                class="rounded-md p-1 text-muted hover:bg-accent-soft hover:text-accent"
                :title="isBlockCollapsed(block) ? 'Buka butir' : 'Tutup butir'"
                :aria-label="isBlockCollapsed(block) ? 'Buka butir' : 'Tutup butir'"
                @click="toggleBlock(block)"
              >
                <ChevronRight class="h-4 w-4 transition-transform" :class="{ 'rotate-90': !isBlockCollapsed(block) }" />
              </button>
              <span
                v-if="compact"
                class="chip shrink-0 bg-accent-soft p-1.5 text-accent"
                :title="blockRegistry[block.type].label"
                :aria-label="blockRegistry[block.type].label"
              >
                <component :is="blockRegistry[block.type].icon" class="h-3.5 w-3.5" />
              </span>
              <span v-else class="chip bg-accent-soft text-accent">{{ blockRegistry[block.type].label }}</span>
              <input v-model="block.title" class="input" placeholder="Judul butir (kosong = tanpa nomor)" />
              <button type="button" class="btn-danger px-2.5" title="Hapus butir" @click="removeBlock(section, bi)">
                <Trash2 class="h-4 w-4" />
              </button>
            </div>
            <component v-if="!isBlockCollapsed(block)" :is="blockRegistry[block.type].Editor" v-model="block.data" />
          </div>
        </VueDraggable>

        <p v-if="!section.blocks.length" class="text-center text-xs text-muted">Belum ada butir. Tambahkan di bawah, atau geser dari bagian lain.</p>

        <div class="flex flex-wrap items-center gap-2">
          <button
            v-for="def in blockDefinitions"
            :key="def.type"
            type="button"
            class="btn gap-1.5 !py-1.5 text-xs"
            :title="def.label"
            :aria-label="def.label"
            @click="addBlock(section, def.type)"
          >
            <component :is="def.icon" class="h-3.5 w-3.5" /> <span v-if="!compact">{{ def.label }}</span>
          </button>

          <select
            class="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-accent-line focus:border-accent focus:outline-none"
            :class="{ '!w-auto !px-2.5': compact }"
            aria-label="Tambah dari templat"
            @change="addPreset(section, $event)"
          >
            <option value="">{{ compact ? '＋' : '＋ Dari templat…' }}</option>
            <optgroup v-for="def in presetGroups" :key="def.type" :label="def.label">
              <option v-for="preset in def.presets" :key="preset.key" :value="`${def.type}:${preset.key}`">{{ preset.label }}</option>
            </optgroup>
          </select>
        </div>
      </div>
    </VueDraggable>

    <button type="button" class="btn w-full gap-1.5" title="Tambah bagian" aria-label="Tambah bagian" @click="addSection">
      <Plus class="h-4 w-4" /> <span v-if="!compact">Tambah bagian</span>
    </button>
  </div>
</template>