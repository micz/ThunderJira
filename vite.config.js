import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import webExtension from '@samrum/vite-plugin-web-extension'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const manifest = JSON.parse(
  readFileSync(resolve(__dirname, 'public/manifest.json'), 'utf-8')
)

export default defineConfig({
  plugins: [
    vue(),
    webExtension({ manifest }),
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
