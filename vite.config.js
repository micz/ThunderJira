import { defineConfig, build as viteBuild } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * Builds content scripts as IIFE in a separate pass.
 * Content scripts run as classic scripts in Thunderbird,
 * so they must be self-contained (no ES module imports).
 */
function buildContentScripts() {
  const entries = {
    'content-scripts/message-overlay': resolve(__dirname, 'src/content-scripts/message-overlay.js'),
  }
  return {
    name: 'build-content-scripts',
    async writeBundle() {
      await viteBuild({
        configFile: false,
        build: {
          emptyOutDir: false,
          outDir: resolve(__dirname, 'dist'),
          copyPublicDir: false,
          rollupOptions: {
            input: entries,
            output: {
              format: 'iife',
              entryFileNames: '[name].js',
            },
          },
        },
      })
    },
  }
}

export default defineConfig({
  root: resolve(__dirname, 'src'),
  publicDir: resolve(__dirname, 'public'),
  plugins: [
    vue(),
    buildContentScripts(),
  ],
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        'background/background': resolve(__dirname, 'src/background/background.js'),
        options: resolve(__dirname, 'src/options/index.html'),
        'tabs/create-issue': resolve(__dirname, 'src/tabs/create-issue/index.html'),
        'tabs/add-comment': resolve(__dirname, 'src/tabs/add-comment/index.html'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
})
