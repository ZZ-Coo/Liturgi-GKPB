// router/index.ts
import { createRouter, createWebHistory } from 'vue-router'
import { resolveTenant } from '@/lib/tenant'
import { useAuthStore } from '@/stores/authStore'

const adminRoutes = [
  { path: '/login', name: 'admin-login', component: () => import('@/views/admin/LoginView.vue') },
  { path: '/', name: 'admin-liturgi-list', component: () => import('@/views/admin/AdminHomeView.vue'), meta: { requiresAuth: true } },
  { path: '/upload', name: 'admin-liturgi-upload', component: () => import('@/views/admin/UploadLiturgiView.vue'), meta: { requiresAuth: true } },
  { path: '/liturgi/:id/edit', name: 'admin-liturgi-edit', component: () => import('@/views/admin/UploadLiturgiView.vue'), meta: { requiresAuth: true } },
  // Warta: any admin (super_admin or jemaat_admin) — RLS scopes jemaat_admin
  // to their own jemaat's rows the same way it already does for liturgi.
  { path: '/warta', name: 'admin-warta-list', component: () => import('@/views/admin/WartaListView.vue'), meta: { requiresAuth: true } },
  { path: '/warta/:id', name: 'admin-warta-edit', component: () => import('@/views/admin/WartaEditView.vue'), meta: { requiresAuth: true } },
  { path: '/kelola-admin', name: 'admin-users', component: () => import('@/views/admin/AdminUsersView.vue'), meta: { requiresAuth: true, requiresSuperAdmin: true } },
  // Unknown admin path (e.g. "/admin/..." typed on admin.localhost, where
  // routes have no /admin prefix): go home instead of rendering a blank page.
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const publicRoutes = [
  { path: '/', name: 'public-liturgi', component: () => import('@/views/public/LiturgiView.vue') },
  { path: '/:tanggal', name: 'public-liturgi-by-date', component: () => import('@/views/public/LiturgiView.vue') },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

// Root is locked by default: RootGate shows the jemaat directory only to a
// logged-in super_admin, everyone else gets the neutral locked page. Any
// other path in root mode is folded back to '/'.
const rootRoutes = [
  { path: '/', name: 'root-landing', component: () => import('@/views/RootGate.vue') },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const tenant = resolveTenant()
const routes = tenant.kind === 'admin' ? adminRoutes : tenant.kind === 'tenant' ? publicRoutes : rootRoutes

// Subdomain mode (or plain root/localhost) keeps routes at "/" like before.
// Path mode (no wildcard domain yet, e.g. *.vercel.app) mounts the same
// route set under a prefix instead — createWebHistory's `base` handles the
// prefixing/stripping automatically, so adminRoutes/publicRoutes below
// don't need any '/admin' or '/j/:slug' baked into their paths.
const base =
  tenant.kind === 'admin' && tenant.mode === 'path'
    ? '/admin'
    : tenant.kind === 'tenant' && tenant.mode === 'path'
      ? `/j/${tenant.slug}`
      : '/'

export const router = createRouter({
  history: createWebHistory(base),
  routes,
})

router.beforeEach(async (to) => {
  if (tenant.kind !== 'admin') return true

  const auth = useAuthStore()
  await auth.initOnce()

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'admin-login' }
  }
  if (to.meta.requiresSuperAdmin && !auth.isSuperAdmin) {
    return { path: '/' }
  }
  return true
})

export { tenant }