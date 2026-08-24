<script setup lang="ts">
// `/` resolves to a different page depending on who's logged in — kept as
// one route (rather than redirecting jemaat_admin elsewhere) so every
// existing `router.push('/')` / `{ name: 'admin-liturgi-list' }` call
// (LoginView, UploadLiturgiView's cancel/save) still lands somewhere
// correct without needing to know the viewer's role itself.
import { useAuthStore } from '@/stores/authStore'
import LiturgiListView from './LiturgiListView.vue'
import JemaatAdminHomeView from './JemaatAdminHomeView.vue'

const auth = useAuthStore()
</script>

<template>
  <JemaatAdminHomeView v-if="auth.adminRole === 'jemaat_admin'" />
  <LiturgiListView v-else />
</template>
