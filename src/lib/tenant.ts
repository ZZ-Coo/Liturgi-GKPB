// lib/tenant.ts
// Resolves the current tenant (jemaat) from the browser hostname, and
// helpers for building/fetching tenant links.

import { supabase } from './supabase'

const ROOT_DOMAIN = import.meta.env.VITE_ROOT_DOMAIN ?? 'liturgigkpb.com'
const RESERVED_SUBDOMAINS = ['admin', 'www']

export type TenantResolution =
  | { kind: 'admin' }
  | { kind: 'tenant'; slug: string }
  | { kind: 'root' }

export function resolveTenant(hostname: string = window.location.hostname): TenantResolution {
  const host = hostname.toLowerCase()

  // Local dev: any *.localhost (or bare "localhost") is treated as its own
  // root domain, regardless of VITE_ROOT_DOMAIN — so admin.localhost and
  // <slug>.localhost work the same way subdomains work in production.
  const effectiveRootDomain = host === 'localhost' || host.endsWith('.localhost') ? 'localhost' : ROOT_DOMAIN

  const isRootDomain = host === effectiveRootDomain
  const suffix = `.${effectiveRootDomain}`

  if (isRootDomain) return { kind: 'root' }
  if (!host.endsWith(suffix)) return { kind: 'root' }

  const subdomain = host.slice(0, -suffix.length)
  if (RESERVED_SUBDOMAINS.includes(subdomain)) return { kind: 'admin' }
  if (subdomain.includes('.') || subdomain === '') return { kind: 'root' }

  return { kind: 'tenant', slug: subdomain }
}

export function buildTenantUrl(slug: string): string {
  const host = window.location.hostname.toLowerCase()
  const isLocal = host === 'localhost' || host.endsWith('.localhost')
  const rootDomain = isLocal ? 'localhost' : ROOT_DOMAIN
  const port = window.location.port ? `:${window.location.port}` : ''
  return `${window.location.protocol}//${slug}.${rootDomain}${port}`
}

export interface JemaatRecord {
  id: string
  slug: string
  name: string
  category: string | null
}

export async function fetchTenantBySlug(slug: string): Promise<JemaatRecord | null> {
  try {
    const { data, error } = await supabase
      .from('jemaat')
      .select('id, slug, name, category')
      .eq('slug', slug)
      .single()

    if (error) {
      if (error.code !== 'PGRST116') console.error('fetchTenantBySlug failed:', error.message)
      return null
    }
    return data
  } catch (err) {
    // Total network failure (DNS, connection refused, etc.) — supabase-js
    // only guarantees a resolved {error} for HTTP-level failures, not for
    // the underlying fetch() rejecting outright. Without this catch, the
    // caller's onMounted would throw and any "loading" flag would get
    // stuck true forever.
    console.error('fetchTenantBySlug network error:', err)
    return null
  }
}

export async function fetchAllJemaat(): Promise<JemaatRecord[]> {
  try {
    const { data, error } = await supabase
      .from('jemaat')
      .select('id, slug, name, category')
      .order('name', { ascending: true })

    if (error) {
      console.error('fetchAllJemaat failed:', error.message)
      return []
    }
    return data ?? []
  } catch (err) {
    console.error('fetchAllJemaat network error:', err)
    return []
  }
}
