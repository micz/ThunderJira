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

import { defineConfig, build as viteBuild } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createXpi } from './build.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * Builds content scripts as IIFE in a separate pass.
 * Content scripts run as classic scripts in Thunderbird,
 * so they must be self-contained (no ES module imports).
 */
function buildContentScripts(isDev) {
  const entries = {
    'content-scripts/message-overlay': resolve(__dirname, 'src/content-scripts/message-overlay.js'),
    'content-scripts/selection-capture': resolve(__dirname, 'src/content-scripts/selection-capture.js'),
  }
  return {
    name: 'build-content-scripts',
    async writeBundle() {
      for (const [name, entry] of Object.entries(entries)) {
        await viteBuild({
          configFile: false,
          build: {
            emptyOutDir: false,
            outDir: resolve(__dirname, 'dist'),
            copyPublicDir: false,
            minify: isDev ? false : 'esbuild',
            rollupOptions: {
              input: { [name]: entry },
              output: {
                format: 'iife',
                entryFileNames: '[name].js',
              },
            },
          },
        })
      }
    },
  }
}

// Export a function instead of a direct object to read the "mode"
export default defineConfig(({ mode }) => {

  console.log('>>> CURRENT VITE MODE:', mode); 
  
  const isDev = mode === 'development';
  console.log('>>> IS DEV?', isDev);

  return {
    root: resolve(__dirname, 'src'),
    publicDir: resolve(__dirname, 'public'),
    plugins: [
      vue(),
      // Pass the isDev flag to your custom plugin
      buildContentScripts(isDev),
      {
        name: 'xpi-packager',
        apply: 'build',
        closeBundle() {
          if (mode === 'production') {
            createXpi();
          }
        }
      },
    ],
    build: {
      outDir: resolve(__dirname, 'dist'),
      emptyOutDir: true,
      // If isDev is true, disable minify, otherwise use default (esbuild)
      minify: isDev ? false : 'esbuild',
      rollupOptions: {
        input: {
          'background/background': resolve(__dirname, 'src/background/background.js'),
          options: resolve(__dirname, 'src/options/index.html'),
          'tabs/create-issue': resolve(__dirname, 'src/tabs/create-issue/index.html'),
          'tabs/add-comment': resolve(__dirname, 'src/tabs/add-comment/index.html'),
          onboarding: resolve(__dirname, 'src/onboarding/index.html'),
        },
        output: {
          entryFileNames: '[name].js',
          chunkFileNames: 'chunks/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
        },
      },
    },
  }
})