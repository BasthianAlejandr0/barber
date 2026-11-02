// Versión demo de server/auth.js. En el navegador no hay secretos que proteger: la
// contraseña es pública y solo da acceso a los datos guardados en este mismo navegador.
export const DEMO_PASSWORD = 'amilcar2026'
const SESSION_MS = 12 * 60 * 60 * 1000

export const usingDefaultPassword = true

export const checkPassword = (password) => password === DEMO_PASSWORD

export const issueToken = () => `demo.${Date.now() + SESSION_MS}`

export function requireAdmin(req, res, next) {
  const [kind, exp] = (req.get('authorization') || '').replace(/^Bearer /, '').split('.')
  if (kind !== 'demo' || !(Number(exp) > Date.now())) {
    return res.status(401).json({ error: 'Tu sesión expiró. Ingresa nuevamente.' })
  }
  next()
}

export const lockedFor = () => 0
export const registerFailure = () => {}
export const clearFailures = () => {}
