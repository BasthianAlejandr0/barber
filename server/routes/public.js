import { Router } from 'express'
import { HttpError, createAppointment, publicView } from '../appointments.js'
import { getDays, getSlots } from '../availability.js'
import { getDb, save } from '../store.js'
import { isValidDate, nowInTz } from '../time.js'

const router = Router()

export function parseDuration(value) {
  const duration = Number(value)
  if (!Number.isInteger(duration) || duration < 5 || duration > 600) throw new HttpError(400, 'Duración no válida.')
  return duration
}

export const publicService = ({ id, type, name, description, price, duration }) => ({
  id,
  type,
  name,
  description,
  price,
  duration,
})

router.get('/config', (req, res) => {
  const { settings } = getDb()
  res.json({
    business: settings.business,
    timezone: settings.timezone,
    slotInterval: settings.slotInterval,
    bookingWindowDays: settings.bookingWindowDays,
    minNoticeMinutes: settings.minNoticeMinutes,
    schedule: settings.schedule,
    today: nowInTz(settings.timezone).date,
  })
})

router.get('/services', (req, res) => {
  res.json(getDb().services.filter((s) => s.active).map(publicService))
})

router.get('/availability/days', (req, res) => {
  res.json(getDays(getDb(), parseDuration(req.query.duration)))
})

router.get('/availability/slots', (req, res) => {
  const { date } = req.query
  if (!isValidDate(date)) throw new HttpError(400, 'Fecha no válida.')
  res.json({ date, ...getSlots(getDb(), date, parseDuration(req.query.duration)) })
})

router.post('/appointments', (req, res) => {
  const db = getDb()
  const appointment = createAppointment(db, req.body)
  save()
  res.status(201).json(publicView(db, appointment))
})

const findByCode = (db, code) => {
  const appointment = db.appointments.find((a) => a.code === String(code).toUpperCase())
  if (!appointment) throw new HttpError(404, 'No encontramos una reserva con ese código.')
  return appointment
}

router.get('/appointments/:code', (req, res) => {
  const db = getDb()
  res.json(publicView(db, findByCode(db, req.params.code)))
})

router.post('/appointments/:code/cancel', (req, res) => {
  const db = getDb()
  const appointment = findByCode(db, req.params.code)
  if (!publicView(db, appointment).cancellable) throw new HttpError(400, 'Esta reserva ya no se puede cancelar.')
  Object.assign(appointment, { status: 'cancelada', cancelledBy: 'cliente', updatedAt: new Date().toISOString() })
  save()
  res.json(publicView(db, appointment))
})

export default router
