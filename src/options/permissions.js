function isLocalhost(url) {
  try {
    const { hostname } = new URL(url)
    return hostname === 'localhost' || hostname === '127.0.0.1'
  } catch {
    return false
  }
}

export async function requestSitePermission(url) {
  // localhost/127.0.0.1 do not match https://*/* or http://*/* (no TLD),
  // so they require the broader <all_urls> grant.
  const origin = isLocalhost(url) ? '<all_urls>' : url.replace(/\/?\*?$/, '/*')

  const hasPermission = await browser.permissions.contains({ origins: [origin] })
  if (hasPermission) return true

  return browser.permissions.request({ origins: [origin] })
}
