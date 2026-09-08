const APP_SCHEME = 'simtracker://'

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function normalizeDeepLink(input: string | null | undefined): string | null {
  if (!input) return null
  const trimmed = input.trim()
  if (!trimmed) return null

  if (trimmed.startsWith(APP_SCHEME)) {
    const withoutScheme = trimmed.slice(APP_SCHEME.length)
    const slashIndex = withoutScheme.indexOf('/')
    const pathAndQuery =
      slashIndex >= 0 ? withoutScheme.slice(slashIndex) : `/${withoutScheme}`
    return normalizeDeepLink(pathAndQuery)
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const url = new URL(trimmed)
      const path = `${url.pathname}${url.search}`
      return normalizeDeepLink(path)
    } catch {
      return null
    }
  }

  const ensuredSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  const withoutGroups = ensuredSlash.replace(/^\/\(([^)]+)\)/, '')
  const decoded = safeDecodeURIComponent(withoutGroups)

  const normalized = decoded === '' ? '/' : decoded

  if (/^\/meters(\/|$)/.test(normalized)) return null
  if (/^\/shipments(\/|$)/.test(normalized)) return null
  if (/^\/sim-cards(\/|$)/.test(normalized)) return null

  return normalized
}

