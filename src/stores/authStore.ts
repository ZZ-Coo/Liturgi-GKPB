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
