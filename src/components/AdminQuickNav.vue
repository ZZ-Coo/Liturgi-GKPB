<script setup lang="ts">
import { computed, onMounted, ref, type Component } from 'vue'
import { useAuthStore } from '@/stores/authStore'
import { buildAdminUrl, buildRootUrl, buildTenantUrl } from '@/lib/tenant'
import { LayoutDashboard, Library, Church } from 'lucide-vue-next'

// Maintenance shortcuts between the three "apps" (admin panel, public jemaat
// page, root directory). They're separate route sets, so these are plain
// links (full page load), not router-links.
//
// Renders NOTHING unless the visitor is a logged-in admin: a jemaat member
// browsing the public page never sees a trace of it. The session lives in
// localStorage, so this only works while the apps share an origin (path mode,
// e.g. *.vercel.app). Once on subdomains, admin.<root> and <slug>.<root> are
// different origins and the buttons will not appear on the public page.
//
// `compact` = icons only (for tight spots like the jemaat header card);
// otherwise the label shows from the sm breakpoint up.
const props = defineProps<{
  links: Array<'admin' | 'root' | 'jemaat'>
  jemaatSlug?: string
  jemaatAccessCode?: string | null
  compact?: boolean
}>()

const auth = useAuthStore()
const ready = ref(false)

onMounted(async () => {
  await auth.initOnce()
  ready.value = true
})

interface NavItem {
  key: string
  label: string
  title: string
  href: string
  icon: Component
}

const items = computed<NavItem[]>(() => {
  if (!ready.value || !auth.adminRole) return []

  const out: NavItem[] = []
  for (const link of props.links) {
    if (link === 'admin') {
      out.push({ key: link, label: 'Panel admin', title: 'Buka panel admin', href: buildAdminUrl(), icon: LayoutDashboard })
    } else if (link === 'root' && auth.isSuperAdmin) {
      out.push({ key: link, label: 'Semua jemaat', title: 'Daftar semua jemaat', href: buildRootUrl(), icon: Library })
    } else if (link === 'jemaat' && props.jemaatSlug) {
      out.push({ key: link, label: 'Halaman jemaat', title: 'Lihat halaman publik jemaat', href: buildTenantUrl(props.jemaatSlug, props.jemaatAccessCode), icon: Church })
    }
  }
  return out
})
</script>

<template>
  <div v-if="items.length" class="flex items-center gap-1.5">
    <a
      v-for="item in items"
      :key="item.key"
      :href="item.href"
      :title="item.title"
      :aria-label="item.title"
      class="group inline-flex h-8 items-center gap-1.5 rounded-full border border-accent-line bg-accent-soft/60 text-xs font-semibold text-accent transition-all hover:-translate-y-px hover:border-accent hover:bg-accent hover:text-white hover:shadow-soft active:translate-y-0"
      :class="compact ? 'w-8 justify-center' : 'px-3'"
    >
      <component :is="item.icon" class="h-3.5 w-3.5" />
      <span v-if="!compact" class="hidden sm:inline">{{ item.label }}</span>
    </a>
  </div>
</template>
