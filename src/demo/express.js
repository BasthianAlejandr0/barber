// Reemplazo mínimo de `express.Router` para la versión demo (GitHub Pages): permite
// ejecutar en el navegador las mismas rutas de server/routes sin cambiarlas.

function compile(path) {
  const names = []
  const pattern = path.replace(/:(\w+)/g, (_, name) => {
    names.push(name)
    return '([^/]+)'
  })
  const regex = new RegExp(`^${pattern}/?$`)
  return (url) => {
    const m = regex.exec(url)
    return m && Object.fromEntries(names.map((n, i) => [n, decodeURIComponent(m[i + 1])]))
  }
}

export function Router() {
  const stack = []
  const route = (method) => (path, handler) => {
    stack.push({ method, match: compile(path), handler })
    return router
  }
  const router = {
    use(handler) {
      stack.push({ handler })
      return router
    },
    get: route('GET'),
    post: route('POST'),
    put: route('PUT'),
    patch: route('PATCH'),
    delete: route('DELETE'),

    /** Atiende la petición y devuelve false si ninguna ruta coincide. */
    async handle(req, res) {
      for (const layer of stack) {
        if (!layer.method) {
          let next = false
          await layer.handler(req, res, () => (next = true))
          if (!next) return true
          continue
        }
        const params = layer.method === req.method && layer.match(req.path)
        if (!params) continue
        req.params = params
        await layer.handler(req, res)
        return true
      }
      return false
    },
  }
  return router
}

export default { Router }
