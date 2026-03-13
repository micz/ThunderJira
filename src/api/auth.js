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

export function buildAuthHeaders({ type, email, apiToken, pat }) {
  if (type === 'cloud') {
    const encoded = btoa(`${email}:${apiToken}`)
    return {
      'Authorization': `Basic ${encoded}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Atlassian-Token': 'no-check',
    }
  }

  if (type === 'server') {
    return {
      'Authorization': `Bearer ${pat}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Atlassian-Token': 'no-check',
      'X-Requested-With': 'XMLHttpRequest',
    }
  }

  throw new Error(`Unknown Jira type: ${type}`)
}
