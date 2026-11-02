import { getSlots } from './availability.js'
import { newId } from './seed.js'
import { isValidDate, isValidTime, nowInTz, toHHMM, toMin } from './time.js'

export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export const STATUSES = ['confirmada', 'completada', 'cancelada', 'no_asistio']

// Sin 0/O ni 1/I para que el código se pueda dictar por teléfono.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function makeCode(db) {
  let code
  do {
    code = [...crypto.getRandomValues(new Uint8Array(8))].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')
  } while (db.appointments.some((a) => a.code === code))
  return code
}

export const cleanText = (value, max) =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : ''

const snapshot = ({ id, name, price, duration }) => ({ id, name, price, duration })

/** Valida el corte y los adicionales elegidos y calcula duración y total. */
function resolveServices(db, serviceId, extraIds, admin) {
  const usable = (s) => admin || s.active
  const service = db.services.find((s) => s.id === serviceId && s.type === 'corte' && usable(s))
  if (!service) throw new HttpError(400, 'Selecciona un corte válido.')

  const ids = [...new Set(Array.isArray(extraIds) ? extraIds : [])]
  const extras = ids.map((id) => db.services.find((s) => s.id === id && s.type === 'adicional' && usable(s)))
  if (extras.some((e) => !e)) throw new HttpError(400, 'Uno de los servicios adicionales ya no está disponible.')

  const items = [service, ...extras]
  return {
    service: snapshot(service),
    extras: extras.map(snapshot),
    duration: items.reduce((t, s) => t + s.duration, 0),
    total: items.reduce((t, s) => t + s.price, 0),
  }
}

function validateCustomer(input = {}) {
  const name = cleanText(input.name, 80)
  const phone = cleanText(input.phone, 24)
  const email = cleanText(input.email, 120).toLowerCase()
  if (name.length < 2) throw new HttpError(400, 'Ingresa tu nombre.')
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 8 || digits.length > 15) throw new HttpError(400, 'Ingresa un teléfono válido.')
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'El correo no es válido.')
  return { name, phone, email }
}

const cleanNotes = (notes) => (typeof notes === 'string' ? notes.trim().slice(0, 300) : '')

/**
 * Comprueba que [time, time + duration) esté libre. El admin puede forzar una
 * hora manual (por ejemplo, un cliente que llegó sin reserva fuera de horario).
 */
function assertBookable(db, date, time, duration, { admin, force, excludeId }) {
  if (!isValidDate(date) || !isValidTime(time)) throw new HttpError(400, 'Fecha u hora no válida.')
  if (toMin(time) + duration > 24 * 60) throw new HttpError(400, 'La cita no puede terminar después de medianoche.')
  if (admin && force) return
  const { slots, closed, reason } = getSlots(db, date, duration, { admin, excludeId })
  if (!slots.includes(time)) {
    throw new HttpError(409, closed ? reason : 'Ese horario ya no está disponible. Elige otro, por favor.')
  }
}

export function createAppointment(db, body = {}, { admin = false } = {}) {
  const { service, extras, duration, total } = resolveServices(db, body.serviceId, body.extraIds, admin)
  const customer = validateCustomer(body.customer)
  const { date, time } = body
  assertBookable(db, date, time, duration, { admin, force: body.force === true })

  const now = new Date().toISOString()
  const appointment = {
    id: newId('apt'),
    code: makeCode(db),
    date,
    time,
    end: toHHMM(toMin(time) + duration),
    duration,
    service,
    extras,
    total,
    customer,
    notes: cleanNotes(body.notes),
    status: 'confirmada',
    source: admin ? 'admin' : 'web',
    createdAt: now,
    updatedAt: now,
  }
  db.appointments.push(appointment)
  return appointment
}

/** Cambios desde el panel: estado, reagendamiento, datos del cliente y notas. */
export function updateAppointment(db, appointment, patch = {}) {
  if (patch.status !== undefined) {
    if (!STATUSES.includes(patch.status)) throw new HttpError(400, 'Estado no válido.')
    // Al reactivar una cita cancelada hay que confirmar que la hora siga libre.
    if (appointment.status === 'cancelada' && patch.status !== 'cancelada' && !patch.date) {
      assertBookable(db, appointment.date, appointment.time, appointment.duration, {
        admin: true,
        force: patch.force === true,
        excludeId: appointment.id,
      })
    }
  }
  if (patch.date !== undefined || patch.time !== undefined) {
    const date = patch.date ?? appointment.date
    const time = patch.time ?? appointment.time
    assertBookable(db, date, time, appointment.duration, {
      admin: true,
      force: patch.force === true,
      excludeId: appointment.id,
    })
    Object.assign(appointment, { date, time, end: toHHMM(toMin(time) + appointment.duration) })
  }
  if (patch.status !== undefined) appointment.status = patch.status
  if (patch.customer !== undefined) appointment.customer = validateCustomer({ ...appointment.customer, ...patch.customer })
  if (patch.notes !== undefined) appointment.notes = cleanNotes(patch.notes)
  appointment.updatedAt = new Date().toISOString()
  return appointment
}

export function isUpcoming(db, appointment) {
  const now = nowInTz(db.settings.timezone)
  return appointment.date > now.date || (appointment.date === now.date && toMin(appointment.time) > now.minutes)
}

/** Lo que ve el cliente con su código: sin teléfono ni correo. */
export function publicView(db, a) {
  return {
    code: a.code,
    date: a.date,
    time: a.time,
    end: a.end,
    duration: a.duration,
    service: a.service,
    extras: a.extras,
    total: a.total,
    customer: { name: a.customer.name },
    notes: a.notes,
    status: a.status,
    cancellable: a.status === 'confirmada' && isUpcoming(db, a),
    createdAt: a.createdAt,
  }
}
