/*
 *  ThunderJira [https://micz.it/thunderbird-addon-thunderjira/]
 *  Copyright (C) 2026 Mic (m@micz.it)

 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.

 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.

 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

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
