const moneyFormat = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
export const money = (n) => moneyFormat.format(n || 0)

export function formatDuration(min) {
  if (!min) return '0 min'
  const h = Math.floor(min / 60)
  const m = min % 60
  if (!h) return `${m} min`
  return m ? `${h} h ${m} min` : `${h} h`
}

export const toMin = (t) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
export const toHHMM = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

// Las fechas 'YYYY-MM-DD' se tratan en UTC para que la zona horaria del
// navegador no corra el día.
const utc = (date) => {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}
export const weekday = (date) => utc(date).getUTCDay()
export const addDays = (date, n) => {
  const d = utc(date)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
export const startOfWeek = (date) => addDays(date, -((weekday(date) + 6) % 7))
export const shiftMonth = (ym, n) => {
  const [y, m] = ym.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7)
}

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1)
const fmt = (date, opts) => capitalize(utc(date).toLocaleDateString('es-CL', { timeZone: 'UTC', ...opts }))

export const longDate = (date) => fmt(date, { weekday: 'long', day: 'numeric', month: 'long' })
export const fullDate = (date) => fmt(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
export const shortDate = (date) => fmt(date, { weekday: 'short', day: 'numeric', month: 'short' })
export const dayMonth = (date) => fmt(date, { day: 'numeric', month: 'short' })
export const monthLabel = (ym) => fmt(`${ym}-01`, { month: 'long', year: 'numeric' })
export const dayName = (date, style = 'short') => fmt(date, { weekday: style }).replace('.', '')

/** Fecha y minuto actual en la zona horaria de la barbería. */
export function nowIn(timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date())
  const get = (type) => parts.find((p) => p.type === type).value
  return { date: `${get('year')}-${get('month')}-${get('day')}`, minutes: Number(get('hour')) * 60 + Number(get('minute')) }
}

export const STATUS_LABEL = {
  confirmada: 'Confirmada',
  completada: 'Completada',
  cancelada: 'Cancelada',
  no_asistio: 'No asistió',
}

export function whatsappLink(phone, text) {
  let digits = (phone || '').replace(/\D/g, '')
  if (digits.length === 9 && digits.startsWith('9')) digits = `56${digits}` // celular chileno sin código de país
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}

export const firstName = (name) => (name || '').trim().split(/\s+/)[0]
