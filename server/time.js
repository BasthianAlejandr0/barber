// Utilidades de fecha y hora. Las fechas viajan como 'YYYY-MM-DD' y las horas
// como 'HH:MM'; internamente se trabaja con minutos desde la medianoche.

export const toMin = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export const toHHMM = (min) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

const utc = (date) => {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

/** 0 = domingo … 6 = sábado, independiente de la zona horaria del servidor. */
export const weekday = (date) => utc(date).getUTCDay()

export const addDays = (date, n) => {
  const d = utc(date)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export const isValidDate = (s) =>
  typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && addDays(s, 0) === s

export const isValidTime = (s) => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s)

/** Fecha y minuto actual en la zona horaria de la barbería. */
export function nowInTz(timeZone) {
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
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  }
}

export const byDateTime = (a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)
