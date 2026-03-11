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
function buildContentScripts(isDev) {
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
          // Applica la logica di minify anche alla build secondaria
          minify: isDev ? false : 'esbuild',
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