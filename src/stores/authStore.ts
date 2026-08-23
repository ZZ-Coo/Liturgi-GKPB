// stores/authStore.ts
import { defineStore } from 'pinia'
import { supabase } from '@/lib/supabase'

type AdminRole = 'jemaat_admin' | 'super_admin'

interface AuthState {
  userId: string | null
  email: string | null
  // The admin_users row for this user — null while it hasn't loaded yet
  // *or* genuinely doesn't exist (an authenticated Supabase user with no
  // admin_users row is not an admin at all; RLS already denies them
  // everything, this just lets the UI reflect that instead of rendering
  // a broken dropdown).
  adminRole: AdminRole | null
  adminJemaatId: string | null
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    userId: null,
    email: null,
    adminRole: null,
    adminJemaatId: null,
  }),

  getters: {
    isAuthenticated: (state) => !!state.userId,
    isSuperAdmin: (state) => state.adminRole === 'super_admin',
    // What UI should scope views/forms to — a jemaat id for jemaat_admin,
    // or null meaning "no restriction" (super_admin, or profile not
    // loaded yet). Views that need to hard-fail closed instead of
    // defaulting open should check `adminRole` directly rather than this.
    scopedJemaatId: (state) => (state.adminRole === 'jemaat_admin' ? state.adminJemaatId : null),
  },

  actions: {
    async init() {
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        this.userId = data.session.user.id
        this.email = data.session.user.email ?? null
        await this.loadAdminProfile()
      }

      // Keeps this store in sync with the actual Supabase session going
      // forward — without this, a token expiring (refresh failure) or a
      // logout from another tab leaves `isAuthenticated` stuck true here
      // even though the server is already rejecting requests, and admin
      // actions (save/delete) start failing with no clear reason why.
      // Safe to subscribe just once: init() itself is only ever called
      // once app-wide (memoized in router/index.ts).
      supabase.auth.onAuthStateChange((_event, session) => {
        const changedUser = session?.user.id !== this.userId
        this.userId = session?.user.id ?? null
        this.email = session?.user.email ?? null
        if (!session) {
          this.adminRole = null
          this.adminJemaatId = null
        } else if (changedUser) {
          void this.loadAdminProfile()
        }
      })
    },

    // Looks up this user's row in `admin_users` (jemaat_id + role — see
    // setup-rls.sql). This is a plain SELECT the user's own RLS policy
    // already allows on themself, so it can't fail for auth reasons; it
    // *can* legitimately come back empty for an authenticated account
    // that was never granted admin access, which is treated the same as
    // "not an admin" everywhere that reads adminRole/scopedJemaatId.
    async loadAdminProfile() {
      if (!this.userId) return
      const { data } = await supabase
        .from('admin_users')
        .select('role, jemaat_id')
        .eq('user_id', this.userId)
        .maybeSingle()
      this.adminRole = (data?.role as AdminRole | undefined) ?? null
      this.adminJemaatId = data?.jemaat_id ?? null
    },

    async login(email: string, password: string) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      this.userId = data.user.id
      this.email = data.user.email ?? null
      await this.loadAdminProfile()
    },

    async logout() {
      await supabase.auth.signOut()
      this.userId = null
      this.email = null
      this.adminRole = null
      this.adminJemaatId = null
    },
  },
})
