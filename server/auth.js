import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

const DEFAULT_PASSWORD = 'amilcar2026'
const PASSWORD = process.env.ADMIN_PASSWORD || DEFAULT_PASSWORD
// Si no se define SESSION_SECRET, cambiar la contraseña invalida las sesiones abiertas.
const SECRET = process.env.SESSION_SECRET || createHash('sha256').update(`amilcar:${PASSWORD}`).digest('hex')
const SESSION_MS = 12 * 60 * 60 * 1000

export const usingDefaultPassword = PASSWORD === DEFAULT_PASSWORD

const sha256 = (value) => createHash('sha256').update(String(value)).digest()
const sign = (body) => createHmac('sha256', SECRET).update(body).digest('base64url')

export const checkPassword = (password) => timingSafeEqual(sha256(password ?? ''), sha256(PASSWORD))

export function issueToken() {
  const body = Buffer.from(JSON.stringify({ exp: Date.now() + SESSION_MS })).toString('base64url')
  return `${body}.${sign(body)}`
}

function verifyToken(token) {
  const [body, signature] = String(token).split('.')
  if (!body || !signature) return false
  const expected = Buffer.from(sign(body))
  const given = Buffer.from(signature)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString()).exp > Date.now()
  } catch {
    return false
  }
}

export function requireAdmin(req, res, next) {
  const header = req.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!verifyToken(token)) return res.status(401).json({ error: 'Tu sesión expiró. Ingresa nuevamente.' })
  next()
}

// Freno simple a la fuerza bruta: 5 intentos fallidos bloquean la IP 5 minutos.
const attempts = new Map()
const MAX_ATTEMPTS = 5
const LOCK_MS = 5 * 60 * 1000

export function lockedFor(ip) {
  const entry = attempts.get(ip)
  return entry && entry.until > Date.now() ? Math.ceil((entry.until - Date.now()) / 60000) : 0
}

export function registerFailure(ip) {
  const entry = attempts.get(ip) || { count: 0, until: 0 }
  entry.count += 1
  if (entry.count >= MAX_ATTEMPTS) Object.assign(entry, { count: 0, until: Date.now() + LOCK_MS })
  attempts.set(ip, entry)
}

export const clearFailures = (ip) => attempts.delete(ip)
