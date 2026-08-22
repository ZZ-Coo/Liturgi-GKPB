// stores/authStore.ts
import { defineStore } from 'pinia'
import { supabase } from '@/lib/supabase'

interface AuthState {
  userId: string | null
  email: string | null
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    userId: null,
    email: null,
  }),

  getters: {
    isAuthenticated: (state) => !!state.userId,
  },

  actions: {
    async init() {
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        this.userId = data.session.user.id
        this.email = data.session.user.email ?? null
      }

      // Keeps this store in sync with the actual Supabase session going
      // forward — without this, a token expiring (refresh failure) or a
      // logout from another tab leaves `isAuthenticated` stuck true here
      // even though the server is already rejecting requests, and admin
      // actions (save/delete) start failing with no clear reason why.
      // Safe to subscribe just once: init() itself is only ever called
      // once app-wide (memoized in router/index.ts).
      supabase.auth.onAuthStateChange((_event, session) => {
        this.userId = session?.user.id ?? null
        this.email = session?.user.email ?? null
      })
    },

    async login(email: string, password: string) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      this.userId = data.user.id
      this.email = data.user.email ?? null
    },

    async logout() {
      await supabase.auth.signOut()
      this.userId = null
      this.email = null
    },
  },
})
