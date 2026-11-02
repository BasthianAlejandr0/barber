// Servidor de la versión demo: atiende en el navegador las mismas rutas que Express
// (server/routes), con los datos en localStorage. Solo se incluye en `npm run build:pages`.
import adminRoutes from '../../server/routes/admin.js'
import publicRoutes from '../../server/routes/public.js'
import { load } from './store.js'

// Igual que por HTTP: lo que entra y sale se copia, nadie toca los objetos guardados.
const copy = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)))

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code
      return this
    },
    json(body) {
      this.body = body
      return this
    },
    end() {
      return this
    },
  }
}

export async function handle(method, url, body, headers = {}) {
  load()
  const [path, search = ''] = url.split('?')
  const isAdmin = path === '/admin' || path.startsWith('/admin/')
  const req = {
    method,
    path: isAdmin ? path.slice('/admin'.length) || '/' : path,
    query: Object.fromEntries(new URLSearchParams(search)),
    params: {},
    body: copy(body),
    ip: 'demo',
    get: (name) => headers[Object.keys(headers).find((h) => h.toLowerCase() === name.toLowerCase())],
  }
  const res = createResponse()

  try {
    const handled = await (isAdmin ? adminRoutes : publicRoutes).handle(req, res)
    if (!handled) res.status(404).json({ error: 'Ruta no encontrada.' })
  } catch (err) {
    const status = err.status || 500
    if (status >= 500) console.error(err)
    res.status(status).json({ error: status >= 500 ? 'Error interno del servidor.' : err.message })
  }
  return { ok: res.statusCode < 400, status: res.statusCode, data: copy(res.body) }
}
