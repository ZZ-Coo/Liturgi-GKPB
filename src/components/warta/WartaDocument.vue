<script setup lang="ts">
import { computed } from 'vue'
import type { WartaSection } from '@/lib/warta/types'
import { numberSections } from '@/lib/warta/numbering'
import { blockRegistry } from '@/lib/warta/blocks'

// The warta as a "sheet of paper": section headings in bold caps
// ("I. KEGIATAN IBADAH"), numbered item headings ("1. SELAMAT DATANG"),
// indented body. Used as-is by the public page and by the builder's live
// preview. Numbers come from numberSections(), never from stored data.
const props = withDefaults(defineProps<{ sections: WartaSection[]; heading?: string }>(), {
  heading: 'Warta Jemaat',
})

const numbered = computed(() => numberSections(props.sections))
</script>

<template>
  <article class="warta-paper">
    <h1 v-if="heading" class="warta-title">{{ heading }}</h1>

    <section v-for="ns in numbered" :key="ns.section.id" class="warta-section">
      <h2 v-if="ns.section.title.trim()" class="warta-section-title">
        <span v-if="ns.label" class="warta-num">{{ ns.label }}</span>
        <span class="warta-section-text">{{ ns.section.title }}</span>
      </h2>

      <div v-for="nb in ns.blocks" :key="nb.block.id" class="warta-block">
        <h3 v-if="nb.block.title?.trim()" class="warta-item-title">
          <span v-if="nb.label" class="warta-num">{{ nb.label }}</span>
          <span>{{ nb.block.title }}</span>
        </h3>
        <div class="warta-body">
          <component :is="blockRegistry[nb.block.type].Renderer" :block="nb.block" />
        </div>
      </div>
    </section>

    <p v-if="!sections.length" class="warta-empty">Belum ada isi warta.</p>
  </article>
</template>

<style>
.warta-paper {
  color: rgb(var(--color-ink));
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-line));
  border-radius: 0.75rem;
  padding: 1.75rem 1.5rem;
  font-size: 0.9rem;
}
@media (min-width: 640px) {
  .warta-paper {
    padding: 2.25rem 2.5rem;
  }
}
.warta-title {
  text-align: center;
  font-weight: 700;
  font-size: 1.05rem;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  margin-bottom: 1.25rem;
}
.warta-section + .warta-section {
  margin-top: 1.25rem;
}
.warta-section-title {
  font-weight: 700;
  text-transform: uppercase;
  margin-bottom: 0.5rem;
}
.warta-section-text {
  text-decoration: underline;
  text-underline-offset: 3px;
}
.warta-num {
  margin-right: 0.5rem;
}
.warta-block {
  margin-top: 0.75rem;
}
.warta-item-title {
  font-weight: 700;
  text-transform: uppercase;
  break-after: avoid;
}
.warta-body {
  padding-left: 1.5rem;
  margin-top: 0.15rem;
}
.warta-empty {
  text-align: center;
  color: rgb(var(--color-muted));
}
@media print {
  .warta-paper {
    border: 0;
    border-radius: 0;
    padding: 0;
    color: #000;
    background: #fff;
  }
}
</style>
