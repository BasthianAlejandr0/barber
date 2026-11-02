import { Router } from 'express'
import { HttpError, STATUSES, cleanText, createAppointment, updateAppointment } from '../appointments.js'
import { OCCUPYING, getSlots } from '../availability.js'
import { checkPassword, clearFailures, issueToken, lockedFor, registerFailure, requireAdmin } from '../auth.js'
import { newId } from '../seed.js'
import { getDb, save } from '../store.js'
import { addDays, byDateTime, isValidDate, isValidTime, nowInTz, toMin, weekday } from '../time.js'
import { parseDuration } from './public.js'

const router = Router()

router.post('/login', (req, res) => {
  const minutes = lockedFor(req.ip)
  if (minutes) throw new HttpError(429, `Demasiados intentos. Espera ${minutes} min e intenta otra vez.`)
  if (!checkPassword(req.body?.password)) {
    registerFailure(req.ip)
    throw new HttpError(401, 'Contraseña incorrecta.')
  }
  clearFailures(req.ip)
  res.json({ token: issueToken() })
})

router.use(requireAdmin)

const findById = (list, id, label) => {
  const item = list.find((x) => x.id === id)
  if (!item) throw new HttpError(404, `${label} no existe.`)
  return item
}

// ─── Resumen ────────────────────────────────────────────────────────────────

router.get('/stats', (req, res) => {
  const db = getDb()
  const now = nowInTz(db.settings.timezone)
  const today = now.date
  const active = db.appointments.filter((a) => a.status !== 'cancelada')
  const revenue = (list) => list.filter((a) => a.status !== 'no_asistio').reduce((t, a) => t + a.total, 0)

  const monday = addDays(today, -((weekday(today) + 6) % 7))
  const sunday = addDays(monday, 6)
  const todayList = active.filter((a) => a.date === today)
  const weekList = active.filter((a) => a.date >= monday && a.date <= sunday)
  const monthCompleted = db.appointments.filter((a) => a.status === 'completada' && a.date.startsWith(today.slice(0, 7)))

  const next =
    active
      .filter((a) => a.status === 'confirmada')
      .filter((a) => a.date > today || (a.date === today && toMin(a.time) + a.duration > now.minutes))
      .sort(byDateTime)[0] ?? null

  const since = addDays(today, -30)
  const counts = {}
  for (const a of active.filter((a) => a.date >= since && a.date <= today)) {
    counts[a.service.name] = (counts[a.service.name] || 0) + 1
  }
  const topServices = Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  res.json({
    today,
    todayCount: todayList.length,
    todayPending: todayList.filter((a) => a.status === 'confirmada').length,
    todayRevenue: revenue(todayList),
    weekCount: weekList.length,
    weekRevenue: revenue(weekList),
    monthCompleted: monthCompleted.length,
    monthRevenue: revenue(monthCompleted),
    next,
    topServices,
  })
})

// ─── Citas ──────────────────────────────────────────────────────────────────

router.get('/appointments', (req, res) => {
  const { from, to, status, q } = req.query
  const search = cleanText(q, 60).toLowerCase()
  const digits = search.replace(/\D/g, '')
  const matches = (a) =>
    a.customer.name.toLowerCase().includes(search) ||
    (digits.length >= 3 && a.customer.phone.replace(/\D/g, '').includes(digits)) ||
    a.code.toLowerCase() === search
  const list = getDb()
    .appointments.filter((a) => !isValidDate(from) || a.date >= from)
    .filter((a) => !isValidDate(to) || a.date <= to)
    .filter((a) => !STATUSES.includes(status) || a.status === status)
    .filter((a) => !search || matches(a))
    .sort(byDateTime)
  res.json(list)
})

router.post('/appointments', (req, res) => {
  const appointment = createAppointment(getDb(), req.body, { admin: true })
  save()
  res.status(201).json(appointment)
})

router.patch('/appointments/:id', (req, res) => {
  const db = getDb()
  const appointment = updateAppointment(db, findById(db.appointments, req.params.id, 'La cita'), req.body)
  save()
  res.json(appointment)
})

router.delete('/appointments/:id', (req, res) => {
  const db = getDb()
  const appointment = findById(db.appointments, req.params.id, 'La cita')
  db.appointments.splice(db.appointments.indexOf(appointment), 1)
  save()
  res.status(204).end()
})

router.get('/availability/slots', (req, res) => {
  const { date, excludeId } = req.query
  if (!isValidDate(date)) throw new HttpError(400, 'Fecha no válida.')
  res.json({ date, ...getSlots(getDb(), date, parseDuration(req.query.duration), { admin: true, excludeId }) })
})

// ─── Servicios ──────────────────────────────────────────────────────────────

function validateService(input = {}) {
  const type = input.type
  if (!['corte', 'adicional'].includes(type)) throw new HttpError(400, 'Tipo de servicio no válido.')
  const name = cleanText(input.name, 60)
  if (name.length < 2) throw new HttpError(400, 'El servicio necesita un nombre.')
  const price = Number(input.price)
  if (!Number.isInteger(price) || price < 0 || price > 1_000_000) throw new HttpError(400, 'Precio no válido.')
  const duration = Number(input.duration)
  if (!Number.isInteger(duration) || duration < 5 || duration > 480) {
    throw new HttpError(400, 'La duración debe estar entre 5 y 480 minutos.')
  }
  return { type, name, description: cleanText(input.description, 160), price, duration, active: input.active !== false }
}

router.get('/services', (req, res) => res.json(getDb().services))

router.post('/services', (req, res) => {
  const service = { id: newId('svc'), ...validateService(req.body) }
  getDb().services.push(service)
  save()
  res.status(201).json(service)
})

router.put('/services/:id', (req, res) => {
  const db = getDb()
  const service = findById(db.services, req.params.id, 'El servicio')
  Object.assign(service, validateService({ ...service, ...req.body }))
  save()
  res.json(service)
})

router.delete('/services/:id', (req, res) => {
  const db = getDb()
  const service = findById(db.services, req.params.id, 'El servicio')
  // Las citas guardan una copia del servicio, así que el historial no se pierde.
  db.services.splice(db.services.indexOf(service), 1)
  save()
  res.status(204).end()
})

// ─── Ajustes ────────────────────────────────────────────────────────────────

const INTERVALS = [10, 15, 20, 30, 45, 60]

function validateSettings(input = {}, current) {
  const b = input.business || {}
  const business = {
    name: cleanText(b.name, 60),
    tagline: cleanText(b.tagline, 140),
    address: cleanText(b.address, 160),
    phone: cleanText(b.phone, 30),
    instagram: cleanText(b.instagram, 60).replace(/^@/, ''),
  }
  if (business.name.length < 2) throw new HttpError(400, 'El negocio necesita un nombre.')

  const slotInterval = Number(input.slotInterval)
  if (!INTERVALS.includes(slotInterval)) throw new HttpError(400, 'Intervalo entre horas no válido.')
  const bookingWindowDays = Number(input.bookingWindowDays)
  if (!Number.isInteger(bookingWindowDays) || bookingWindowDays < 1 || bookingWindowDays > 180) {
    throw new HttpError(400, 'Los días de anticipación deben estar entre 1 y 180.')
  }
  const minNoticeMinutes = Number(input.minNoticeMinutes)
  if (!Number.isInteger(minNoticeMinutes) || minNoticeMinutes < 0 || minNoticeMinutes > 2880) {
    throw new HttpError(400, 'La anticipación mínima no es válida.')
  }

  if (!Array.isArray(input.schedule) || input.schedule.length !== 7) throw new HttpError(400, 'Horario no válido.')
  const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
  const schedule = input.schedule.map((d, i) => {
    const day = {
      open: d?.open === true,
      start: isValidTime(d?.start) ? d.start : current.schedule[i].start,
      end: isValidTime(d?.end) ? d.end : current.schedule[i].end,
      breakStart: isValidTime(d?.breakStart) ? d.breakStart : '',
      breakEnd: isValidTime(d?.breakEnd) ? d.breakEnd : '',
    }
    if (!day.open) return day
    if (toMin(day.end) <= toMin(day.start)) throw new HttpError(400, `Revisa el horario del ${DAYS[i]}: el cierre debe ser después de la apertura.`)
    if (Boolean(day.breakStart) !== Boolean(day.breakEnd)) {
      throw new HttpError(400, `Completa el inicio y el fin de la pausa del ${DAYS[i]}.`)
    }
    if (
      day.breakStart &&
      (toMin(day.breakEnd) <= toMin(day.breakStart) ||
        toMin(day.breakStart) < toMin(day.start) ||
        toMin(day.breakEnd) > toMin(day.end))
    ) {
      throw new HttpError(400, `La pausa del ${DAYS[i]} debe quedar dentro del horario de atención.`)
    }
    return day
  })

  return { ...current, business, slotInterval, bookingWindowDays, minNoticeMinutes, schedule }
}

router.get('/settings', (req, res) => res.json(getDb().settings))

router.put('/settings', (req, res) => {
  const db = getDb()
  db.settings = validateSettings(req.body, db.settings)
  save()
  res.json(db.settings)
})

// ─── Bloqueos (días libres u horas tomadas) ─────────────────────────────────

router.get('/blocks', (req, res) => {
  const db = getDb()
  const from = isValidDate(req.query.from) ? req.query.from : nowInTz(db.settings.timezone).date
  const to = isValidDate(req.query.to) ? req.query.to : null
  res.json(
    db.blocks
      .filter((b) => b.date >= from && (!to || b.date <= to))
      .sort((a, b) => a.date.localeCompare(b.date) || (a.start || '').localeCompare(b.start || '')),
  )
})

router.post('/blocks', (req, res) => {
  const db = getDb()
  const { date, allDay } = req.body || {}
  if (!isValidDate(date)) throw new HttpError(400, 'Fecha no válida.')
  const block = { id: newId('blk'), date, start: '', end: '', reason: cleanText(req.body.reason, 80) }
  if (!allDay) {
    const { start, end } = req.body
    if (!isValidTime(start) || !isValidTime(end) || toMin(end) <= toMin(start)) {
      throw new HttpError(400, 'Revisa el rango de horas del bloqueo.')
    }
    Object.assign(block, { start, end })
  }
  db.blocks.push(block)
  save()

  // Avisamos si el bloqueo pisa citas ya confirmadas (no se cancelan solas).
  const conflicts = db.appointments.filter(
    (a) =>
      a.date === date &&
      OCCUPYING.has(a.status) &&
      (!block.start || (toMin(a.time) < toMin(block.end) && toMin(block.start) < toMin(a.time) + a.duration)),
  ).length
  res.status(201).json({ ...block, conflicts })
})

router.delete('/blocks/:id', (req, res) => {
  const db = getDb()
  const block = findById(db.blocks, req.params.id, 'El bloqueo')
  db.blocks.splice(db.blocks.indexOf(block), 1)
  save()
  res.status(204).end()
})

export default router
