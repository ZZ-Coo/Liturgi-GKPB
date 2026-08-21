// router/index.ts
import { createRouter, createWebHistory } from 'vue-router'
import { resolveTenant } from '@/lib/tenant'
import { useAuthStore } from '@/stores/authStore'

const adminRoutes = [
  { path: '/login', name: 'admin-login', component: () => import('@/views/admin/LoginView.vue') },
  { path: '/', name: 'admin-liturgi-list', component: () => import('@/views/admin/LiturgiListView.vue'), meta: { requiresAuth: true } },
  { path: '/upload', name: 'admin-liturgi-upload', component: () => import('@/views/admin/UploadLiturgiView.vue'), meta: { requiresAuth: true } },
  { path: '/liturgi/:id/edit', name: 'admin-liturgi-edit', component: () => import('@/views/admin/UploadLiturgiView.vue'), meta: { requiresAuth: true } },
]

const publicRoutes = [
  { path: '/', name: 'public-liturgi', component: () => import('@/views/public/LiturgiView.vue') },
  { path: '/:tanggal', name: 'public-liturgi-by-date', component: () => import('@/views/public/LiturgiView.vue') },
]

const rootRoutes = [
  { path: '/', name: 'root-landing', component: () => import('@/views/RootView.vue') },
]

const tenant = resolveTenant()
const routes = tenant.kind === 'admin' ? adminRoutes : tenant.kind === 'tenant' ? publicRoutes : rootRoutes

export const router = createRouter({
  history: createWebHistory(),
  routes,
})

let authReady: Promise<void> | null = null

router.beforeEach(async (to) => {
  if (tenant.kind !== 'admin') return true

  const auth = useAuthStore()
  if (!authReady) authReady = auth.init()
  await authReady

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'admin-login' }
  }
  return true
})

export { tenant }
