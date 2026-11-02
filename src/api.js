const TOKEN_KEY = 'amilcar.admin.token'
let memoryToken = null

export const session = {
  get token() {
    try {
      return localStorage.getItem(TOKEN_KEY) ?? memoryToken
    } catch {
      return memoryToken
    }
  },
  set(token) {
    memoryToken = token
    try {
      localStorage.setItem(TOKEN_KEY, token)
    } catch {}
  },
  clear() {
    memoryToken = null
    try {
      localStorage.removeItem(TOKEN_KEY)
    } catch {}
  },
}

// La versión de GitHub Pages (`npm run build:pages`) no tiene servidor: las mismas rutas
// de Express corren en el navegador. En el build normal este bloque se elimina.
export const DEMO = import.meta.env.MODE === 'pages'

async function send(method, path, body, headers) {
  if (import.meta.env.MODE === 'pages') {
    const { handle } = await import('./demo/server.js')
    return handle(method, path, body, headers)
  }
  let res
  try {
    res = await fetch(`/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch {
    throw Object.assign(new Error('No pudimos conectar con el servidor. Revisa tu conexión.'), { status: 0 })
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null)
  return { ok: res.ok, status: res.status, data }
}

/** Solo en la demo: borra los datos guardados en este navegador. */
export async function resetDemo() {
  if (import.meta.env.MODE !== 'pages') return
  const { reset } = await import('./demo/store.js')
  reset()
  session.clear()
}

async function request(method, path, body, admin = false) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (admin && session.token) headers.Authorization = `Bearer ${session.token}`

  const res = await send(method, path, body, headers)
  const { data } = res
  if (!res.ok) {
    if (res.status === 401 && admin) {
      session.clear()
      window.dispatchEvent(new CustomEvent('admin:unauthorized'))
    }
    throw Object.assign(new Error(data?.error || 'Algo salió mal. Intenta nuevamente.'), { status: res.status })
  }
  return data
}

const qs = (params = {}) => {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') p.set(k, v)
  const s = p.toString()
  return s ? `?${s}` : ''
}

export const api = {
  config: () => request('GET', '/config'),
  services: () => request('GET', '/services'),
  days: (duration) => request('GET', `/availability/days${qs({ duration })}`),
  slots: (date, duration) => request('GET', `/availability/slots${qs({ date, duration })}`),
  book: (payload) => request('POST', '/appointments', payload),
  appointment: (code) => request('GET', `/appointments/${encodeURIComponent(code)}`),
  cancel: (code) => request('POST', `/appointments/${encodeURIComponent(code)}/cancel`),
}

const A = (method, path, body) => request(method, `/admin${path}`, body, true)

export const admin = {
  login: (password) => request('POST', '/admin/login', { password }),
  stats: () => A('GET', '/stats'),
  appointments: (params) => A('GET', `/appointments${qs(params)}`),
  createAppointment: (payload) => A('POST', '/appointments', payload),
  updateAppointment: (id, patch) => A('PATCH', `/appointments/${id}`, patch),
  deleteAppointment: (id) => A('DELETE', `/appointments/${id}`),
  slots: (date, duration, excludeId) => A('GET', `/availability/slots${qs({ date, duration, excludeId })}`),
  services: () => A('GET', '/services'),
  createService: (service) => A('POST', '/services', service),
  updateService: (id, service) => A('PUT', `/services/${id}`, service),
  deleteService: (id) => A('DELETE', `/services/${id}`),
  settings: () => A('GET', '/settings'),
  saveSettings: (settings) => A('PUT', '/settings', settings),
  blocks: (params) => A('GET', `/blocks${qs(params)}`),
  createBlock: (block) => A('POST', '/blocks', block),
  deleteBlock: (id) => A('DELETE', `/blocks/${id}`),
}
