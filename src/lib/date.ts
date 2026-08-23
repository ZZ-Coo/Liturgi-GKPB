// lib/date.ts
// Small date-formatting helper. Note: this app intentionally does NOT
// assume services happen on Sunday — some jemaat also run midweek
// services (Kamis, etc.) — so nearestSundayIso() below is NOT "the day
// liturgi happens." It's purely a navigation anchor for
// AdminOverviewView's weekly calendar (pick a consistent axis to page
// through, independent of which day(s) any given jemaat actually meets).
// The public liturgi page still asks the data itself which date to
// default to (see liturgiStore.resolveDefaultDate) — this helper is
// admin-dashboard-only.

export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function nearestSundayIso(from: Date = new Date()): string {
  const d = new Date(from)
  d.setDate(d.getDate() - d.getDay()) // getDay(): 0 = Sunday — rolls back to the most recent one
  return toIsoDate(d)
}
