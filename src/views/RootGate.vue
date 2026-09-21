<script setup lang="ts">
import { ref, onMounted, defineAsyncComponent } from 'vue'
import { useAuthStore } from '@/stores/authStore'
import LockedView from '@/views/LockedView.vue'

// Root ("/") is locked by default. The jemaat directory is only ever
// rendered — and its code only ever downloaded — for a logged-in
// super_admin; everyone else, including anyone still waiting on the
// session check, sees the neutral locked page.
//
// This gate is UI only. The real protection is in the database: anon has
// no table access, so a non-admin can't list jemaat through the API either
// (see db/setup.sql).
const RootView = defineAsyncComponent(() => import('@/views/RootView.vue'))

const auth = useAuthStore()
const checked = ref(false)

onMounted(async () => {
  await auth.initOnce()
  checked.value = true
})
</script>

<template>
  <RootView v-if="checked && auth.isSuperAdmin" />
  <LockedView v-else />
</template>
