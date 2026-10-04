export function toIsoDate(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function today() {
  return toIsoDate(new Date())
}

export function addDays(isoDate: string, days: number) {
  const [y, m, d] = isoDate.split('-').map(Number)
  return toIsoDate(new Date(y, m - 1, d + days))
}

export function formatDay(isoDate: string) {
  if (isoDate === today()) return 'Azi'
  if (isoDate === addDays(today(), -1)) return 'Ieri'
  if (isoDate === addDays(today(), 1)) return 'Mâine'
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Intl.DateTimeFormat('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(y, m - 1, d))
}

export function shortDate(isoDate: string) {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'short' }).format(new Date(y, m - 1, d)).replace('.', '')
}
