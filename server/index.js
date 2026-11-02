import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { usingDefaultPassword } from './auth.js'
import adminRoutes from './routes/admin.js'
import publicRoutes from './routes/public.js'
import { DB_FILE, load } from './store.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.resolve(__dirname, '../dist')
// En desarrollo se fija con --port para no chocar con el PORT que usa Vite.
const { values: args } = parseArgs({ options: { port: { type: 'string' } }, strict: false })
const PORT = Number(args.port || process.env.PORT) || 3001

load()

const app = express()
app.disable('x-powered-by')
if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY)
app.use(express.json({ limit: '50kb' }))

app.use('/api/admin', adminRoutes)
app.use('/api', publicRoutes)
app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }))

// En producción Express también sirve la app de Vue ya compilada (npm run build).
if (fs.existsSync(path.join(DIST, 'index.html'))) {
  app.use('/assets', express.static(path.join(DIST, 'assets'), { immutable: true, maxAge: '1y' }))
  app.use(express.static(DIST, { index: false }))
  app.use((req, res, next) => (req.method === 'GET' ? res.sendFile(path.join(DIST, 'index.html')) : next()))
}

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Datos con formato inválido.' })
  const status = err.status || err.statusCode || 500
  if (status >= 500) console.error(err)
  res.status(status).json({ error: status >= 500 ? 'Error interno del servidor.' : err.message })
})

app.listen(PORT, () => {
  console.log(`Amílcar Barbero · API en http://localhost:${PORT}`)
  console.log(`Datos en ${DB_FILE}`)
  if (usingDefaultPassword) {
    console.warn('Aviso: se está usando la contraseña de administrador por defecto. Define ADMIN_PASSWORD en .env')
  }
})
