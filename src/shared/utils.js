export function stripTrailingSlash(url) {
  return url.endsWith('/') ? url.slice(0, -1) : url
}

export function isValidUrl(str) {
  try {
    new URL(str)
    return true
  } catch {
    return false
  }
}
