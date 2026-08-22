// lib/tenant.ts
// Resolves the current tenant (jemaat) from the browser hostname, and
// helpers for building/fetching tenant links.

import { supabase } from './supabase'

const ROOT_DOMAIN = import.meta.env.VITE_ROOT_DOMAIN ?? 'liturgigkpb.com'
const RESERVED_SUBDOMAINS = ['admin', 'www']

export type TenantResolution =
  | { kind: 'admin'; mode: 'subdomain' | 'path' }
  | { kind: 'tenant'; slug: string; mode: 'subdomain' | 'path' }
  | { kind: 'root' }

// Resolves which "app" to show: admin panel, a specific jemaat's liturgi
// page, or the root "pilih jemaat" landing page.
//
// Two resolution strategies, tried in order:
//   1. Subdomain (admin.liturgigkpb.com, sion-melaya.liturgigkpb.com) — the
//      real long-term scheme, but it only works once a custom domain with
//      wildcard DNS is pointed at Vercel (arbitrary *.vercel.app subdomains
//      don't resolve at all — Vercel doesn't support wildcards on its own
//      default project domain, only on custom domains you own).
//   2. Path (/admin, /j/sion-melaya) — works on ANY domain, including the
//      plain *.vercel.app one Vercel gives you before a custom domain is
//      set up. Also just works as an alternate URL scheme even once the
//      real domain is live, so old /j/... links never break.
export function resolveTenant(
  hostname: string = window.location.hostname,
  pathname: string = window.location.pathname,
): TenantResolution {
  const host = hostname.toLowerCase()

  // Local dev: any *.localhost (or bare "localhost") is treated as its own
  // root domain, regardless of VITE_ROOT_DOMAIN — so admin.localhost and
  // <slug>.localhost work the same way subdomains work in production.
  const effectiveRootDomain = host === 'localhost' || host.endsWith('.localhost') ? 'localhost' : ROOT_DOMAIN
  const isRootDomain = host === effectiveRootDomain
  const suffix = `.${effectiveRootDomain}`

  if (host.endsWith(suffix)) {
    const subdomain = host.slice(0, -suffix.length)
    if (RESERVED_SUBDOMAINS.includes(subdomain)) return { kind: 'admin', mode: 'subdomain' }
    if (subdomain && !subdomain.includes('.')) return { kind: 'tenant', slug: subdomain, mode: 'subdomain' }
    // malformed subdomain (nested/blank) — falls through to the path check
  }

  // Path-based fallback — this is what actually fires today on
  // liturgi-gkpb.vercel.app, and also on the real root domain itself
  // (isRootDomain) so /admin and /j/:slug work there too as a bonus.
  if (isRootDomain || !host.endsWith(suffix)) {
    if (pathname === '/admin' || pathname.startsWith('/admin/')) return { kind: 'admin', mode: 'path' }
    const tenantMatch = pathname.match(/^\/j\/([^/]+)/)
    if (tenantMatch) return { kind: 'tenant', slug: tenantMatch[1], mode: 'path' }
  }

  return { kind: 'root' }
}

export function buildTenantUrl(slug: string): string {
  const host = window.location.hostname.toLowerCase()
  const isLocal = host === 'localhost' || host.endsWith('.localhost')
  const rootDomain = isLocal ? 'localhost' : ROOT_DOMAIN
  const canUseSubdomain = isLocal || host === rootDomain
  const port = window.location.port ? `:${window.location.port}` : ''

  if (canUseSubdomain) {
    return `${window.location.protocol}//${slug}.${rootDomain}${port}`
  }
  // No wildcard domain yet (e.g. still on *.vercel.app) — path-based link.
  return `/j/${slug}`
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