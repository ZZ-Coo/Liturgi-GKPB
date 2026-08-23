// lib/date.ts
// Small date-formatting helper. Note: this app intentionally does NOT
// assume services happen on Sunday — some jemaat also run midweek
// services (Kamis, etc.) — so there's no "nearest Sunday" helper here.
// The public liturgi page instead asks the data itself which date to
// default to (see liturgiStore.resolveDefaultDate).

export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}
