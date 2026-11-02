import { addDays, nowInTz, toHHMM, toMin, weekday } from './time.js'

/** Estados que ocupan la hora en la agenda (las canceladas la liberan). */
export const OCCUPYING = new Set(['confirmada', 'completada', 'no_asistio'])

const overlaps = (a1, a2, b1, b2) => a1 < b2 && b1 < a2

export function daySchedule(settings, date) {
  const s = settings.schedule[weekday(date)]
  if (!s?.open) return null
  const start = toMin(s.start)
  const end = toMin(s.end)
  if (end <= start) return null
  const pause = s.breakStart && s.breakEnd ? [toMin(s.breakStart), toMin(s.breakEnd)] : null
  return { start, end, pause: pause && pause[1] > pause[0] ? pause : null }
}

export const fullDayBlock = (db, date) => db.blocks.find((b) => b.date === date && !b.start)

function busyIntervals(db, date, excludeId) {
  const list = []
  for (const a of db.appointments) {
    if (a.date !== date || a.id === excludeId || !OCCUPYING.has(a.status)) continue
    const start = toMin(a.time)
    list.push([start, start + a.duration])
  }
  for (const b of db.blocks) {
    if (b.date === date && b.start) list.push([toMin(b.start), toMin(b.end)])
  }
  return list
}

/**
 * Horas de inicio disponibles para un servicio de `duration` minutos.
 * - Clientes: respetan la anticipación mínima y la ventana de reservas.
 * - Admin: puede agendar cualquier día futuro y sin anticipación mínima.
 */
export function getSlots(db, date, duration, { admin = false, excludeId, ignoreNow = false } = {}) {
  const { settings } = db
  const now = ignoreNow ? { date: '0000-00-00', minutes: 0 } : nowInTz(settings.timezone)

  if (date < now.date) return { closed: true, reason: 'Esta fecha ya pasó.', slots: [] }
  if (!admin && date > addDays(now.date, settings.bookingWindowDays - 1)) {
    return { closed: true, reason: 'Aún no se abren las reservas para esta fecha.', slots: [] }
  }
  const block = fullDayBlock(db, date)
  if (block) return { closed: true, reason: block.reason || 'Día no disponible.', slots: [] }
  const sched = daySchedule(settings, date)
  if (!sched) return { closed: true, reason: 'La barbería está cerrada este día.', slots: [] }

  const busy = busyIntervals(db, date, excludeId)
  if (sched.pause) busy.push(sched.pause)

  // Además de la grilla regular se ofrecen las horas en que termina una cita,
  // así no quedan huecos de 10–15 minutos sin poder agendar.
  const candidates = new Set()
  for (let t = sched.start; t < sched.end; t += settings.slotInterval) candidates.add(t)
  for (const [, end] of busy) if (end > sched.start && end < sched.end) candidates.add(end)

  const minStart = date === now.date ? now.minutes + (admin ? 0 : settings.minNoticeMinutes) : -Infinity
  const slots = [...candidates]
    .sort((a, b) => a - b)
    .filter((t) => t >= minStart && t + duration <= sched.end)
    .filter((t) => !busy.some(([s, e]) => overlaps(t, t + duration, s, e)))
    .map(toHHMM)

  return { closed: false, slots }
}

/** Cantidad de horas libres por día dentro de la ventana de reservas. */
export function getDays(db, duration) {
  const { settings } = db
  const today = nowInTz(settings.timezone).date
  const days = {}
  for (let i = 0; i < settings.bookingWindowDays; i++) {
    const date = addDays(today, i)
    days[date] = getSlots(db, date, duration).slots.length
  }
  return { today, days }
}
