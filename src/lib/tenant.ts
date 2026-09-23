// lib/tenant.ts
// Resolves the current tenant (jemaat) from the browser hostname, and
// helpers for building/fetching tenant links.

import { supabase } from './supabase'

const ROOT_DOMAIN = import.meta.env.VITE_ROOT_DOMAIN ?? 'liturgigkpb.com'
const RESERVED_SUBDOMAINS = ['admin', 'www']

export type TenantResolution =
  | { kind: 'admin'; mode: 'subdomain' | 'path' }
  | { kind: 'tenant'; slug: string; code: string | null; mode: 'subdomain' | 'path' }
  | { kind: 'root' }

// An access code (see JemaatRecord.accessCode) is a 6-character suffix,
// hyphen-joined onto the slug, that ALWAYS starts with a digit:
// /j/hosana-kwanji-x7k2f9. Jemaat slugs are plain Indonesian words and never
// contain digits, so requiring the code's first character to be one is what
// makes "hosana-kwanji-x7k2f9" unambiguously split into slug "hosana-kwanji"
// + code "x7k2f9" — and, just as importantly, makes a plain coded-less slug
// like "hosana-kwanji" impossible to misread as slug "hosana" + code
// "kwanji" just because its last hyphenated word happens to be 6 characters.
const CODE_SUFFIX = /^(.+)-(\d[a-z0-9]{5})$/

function splitSlugAndCode(segment: string): { slug: string; code: string | null } {
  const match = CODE_SUFFIX.exec(segment)
  return match ? { slug: match[1], code: match[2] } : { slug: segment, code: null }
}

// Inverse of splitSlugAndCode — the literal URL segment for a slug+code
// pair. Exported so router.ts can rebuild the exact path-mode base
// (`/j/<segment>`) that was actually matched, code included.
export function tenantSegment(slug: string, code?: string | null): string {
  return code ? `${slug}-${code}` : slug
}

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
    if (subdomain && !subdomain.includes('.')) return { kind: 'tenant', ...splitSlugAndCode(subdomain), mode: 'subdomain' }
    // malformed subdomain (nested/blank) — falls through to the path check
  }

  // Path-based fallback — this is what actually fires today on
  // liturgi-gkpb.vercel.app, and also on the real root domain itself
  // (isRootDomain) so /admin and /j/:slug work there too as a bonus.
  if (isRootDomain || !host.endsWith(suffix)) {
    if (pathname === '/admin' || pathname.startsWith('/admin/')) return { kind: 'admin', mode: 'path' }
    const tenantMatch = pathname.match(/^\/j\/([^/]+)/)
    if (tenantMatch) return { kind: 'tenant', ...splitSlugAndCode(tenantMatch[1]), mode: 'path' }
  }

  return { kind: 'root' }
}

// The three build*Url helpers below all answer the same question — "can I
// link across apps with a subdomain, or do I have to fall back to a path?" —
// so they share this.
function urlContext() {
  const host = window.location.hostname.toLowerCase()
  const isLocal = host === 'localhost' || host.endsWith('.localhost')
  const rootDomain = isLocal ? 'localhost' : ROOT_DOMAIN
  return {
    rootDomain,
    // On the root domain itself OR any of its subdomains: if we're already
    // being served from <something>.liturgigkpb.com, the wildcard DNS works,
    // so linking to admin.<root> / <root> / <slug>.<root> from there is safe.
    canUseSubdomain: isLocal || host === rootDomain || host.endsWith(`.${rootDomain}`),
    origin: (sub?: string) =>
      `${window.location.protocol}//${sub ? `${sub}.` : ''}${rootDomain}${window.location.port ? `:${window.location.port}` : ''}`,
  }
}

export function buildTenantUrl(slug: string, accessCode?: string | null): string {
  const segment = tenantSegment(slug, accessCode)
  const ctx = urlContext()
  if (ctx.canUseSubdomain) return ctx.origin(segment)
  // No wildcard domain yet (e.g. still on *.vercel.app) — path-based link.
  return `/j/${segment}`
}

// Link to the "pilih jemaat" landing page (locked for everyone but a
// logged-in super_admin — see RootGate). Mirrors buildTenantUrl's two modes.
export function buildRootUrl(): string {
  const ctx = urlContext()
  return ctx.canUseSubdomain ? ctx.origin() : '/'
}

// Link to the admin panel, same two modes: admin.<root> or /admin.
export function buildAdminUrl(): string {
  const ctx = urlContext()
  return ctx.canUseSubdomain ? ctx.origin('admin') : '/admin'
}

export interface JemaatRecord {
  id: string
  slug: string
  name: string
  category: string | null
  // Only meaningful on the admin side (fetchAllJemaat) — the public lookup
  // (fetchTenantBySlug) never returns this, since the whole point is that
  // an anon visitor can't discover it from the API. null = link works with
  // just the slug, no code needed.
  accessCode?: string | null
}

// Public lookup — anon has no direct access to the `jemaat` table (see
// db/setup.sql), so this goes through get_public_jemaat(slug, code), which
// only ever returns the one jemaat whose slug was asked for, and only if
// its accessCode (when it has one) matches what was passed.
export async function fetchTenantBySlug(slug: string, code: string | null = null): Promise<JemaatRecord | null> {
  try {
    const { data, error } = await supabase.rpc('get_public_jemaat', { p_slug: slug, p_code: code })

    if (error) {
      console.error('fetchTenantBySlug failed:', error.message)
      return null
    }
    return ((data ?? []) as JemaatRecord[])[0] ?? null
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

// Admin-side only: RLS returns every jemaat to a super_admin, just their own
// to a jemaat_admin, and nothing (permission denied) to anon.
export async function fetchAllJemaat(): Promise<JemaatRecord[]> {
  try {
    const { data, error } = await supabase
      .from('jemaat')
      .select('id, slug, name, category, accessCode')
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