export function normalize(text: string) {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

function withinOneEdit(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0
  let j = 0
  let edits = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++
      j++
      continue
    }
    if (++edits > 1) return false
    if (a.length > b.length) i++
    else if (a.length < b.length) j++
    else {
      i++
      j++
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1
}

function tokenScore(token: string, words: string[], whole: string) {
  if (words.some((w) => w.startsWith(token))) return 3
  if (whole.includes(token)) return 2
  if (token.length >= 4 && words.some((w) => withinOneEdit(token, w.slice(0, token.length)) || withinOneEdit(token, w))) return 1
  return 0
}

export function searchScore(query: string, text: string) {
  const q = normalize(query)
  if (!q) return 1
  const whole = normalize(text)
  const words = whole.split(/[^a-z0-9]+/).filter(Boolean)
  let total = 0
  for (const token of q.split(/\s+/)) {
    const score = tokenScore(token, words, whole)
    if (score === 0) return 0
    total += score
  }
  return total
}

export function search<T>(items: T[], query: string, text: (item: T) => string) {
  if (!normalize(query)) return items
  return items
    .map((item) => ({ item, score: searchScore(query, text(item)) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.item)
}
