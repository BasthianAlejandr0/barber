import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'
import { defineConfig, normalizePath } from 'vite'

const file = (path) => normalizePath(fileURLToPath(new URL(path, import.meta.url)))

// Para la demo de GitHub Pages (`--mode pages`) las rutas de server/routes se ejecutan en
// el navegador: express, store.js y auth.js se cambian por sus versiones de src/demo.
const SWAPS = {
  [file('./server/store.js')]: file('./src/demo/store.js'),
  [file('./server/auth.js')]: file('./src/demo/auth.js'),
}

const demoBackend = {
  name: 'demo-backend',
  enforce: 'pre',
  async resolveId(source, importer, options) {
    if (source === 'express') return file('./src/demo/express.js')
    if (!source.startsWith('.') || !importer) return null
    const resolved = await this.resolve(source, importer, { ...options, skipSelf: true })
    return resolved && SWAPS[resolved.id] ? SWAPS[resolved.id] : null
  },
}

export default defineConfig(({ mode }) => ({
  plugins: [vue(), mode === 'pages' && demoBackend],
  // Rutas relativas: la demo funciona en basthianalejandr0.github.io/barber o en cualquier carpeta.
  base: mode === 'pages' ? './' : '/',
  define: mode === 'pages' ? { 'process.env.TIMEZONE': 'undefined' } : {},
  server: {
    port: Number(process.env.PORT) || 5173,
    strictPort: true,
    proxy: { '/api': 'http://localhost:3001' },
  },
}))
