// Citas de ejemplo para hoy y los próximos días. Las usan `npm run demo` y la versión demo de GitHub Pages.
import { createAppointment } from './appointments.js'
import { getSlots } from './availability.js'
import { addDays, nowInTz, toMin } from './time.js'

const people = [
  ['Matías Rojas', '+56 9 5555 0101'],
  ['Benjamín Soto', '+56 9 5555 0102'],
  ['Joaquín Muñoz', '+56 9 5555 0103'],
  ['Tomás Díaz', '+56 9 5555 0104'],
  ['Vicente Pérez', '+56 9 5555 0105'],
  ['Diego Contreras', '+56 9 5555 0106'],
  ['Agustín Silva', '+56 9 5555 0107'],
  ['Martín Fuentes', '+56 9 5555 0108'],
]

/** Agrega hasta 5 citas por día y devuelve cuántas creó. */
export function addSampleAppointments(db) {
  const now = nowInTz(db.settings.timezone)
  const cuts = db.services.filter((s) => s.type === 'corte' && s.active)
  const extras = db.services.filter((s) => s.type === 'adicional' && s.active)
  let n = 0

  for (let d = 0; d < 6; d++) {
    const date = addDays(now.date, d)
    for (let k = 0; k < 5; k++) {
      const service = cuts[n % cuts.length]
      const extra = n % 3 === 0 && extras.length ? extras[n % extras.length] : null
      const duration = service.duration + (extra?.duration ?? 0)
      const { slots } = getSlots(db, date, duration, { admin: true, ignoreNow: true })
      if (!slots.length) break
      const [name, phone] = people[n % people.length]
      const time = slots[Math.min(slots.length - 1, k * 3)]
      const appointment = createAppointment(
        db,
        { serviceId: service.id, extraIds: extra ? [extra.id] : [], date, time, force: true, customer: { name, phone } },
        { admin: true },
      )
      // Las citas de hoy que ya pasaron quedan como atendidas.
      if (d === 0 && toMin(time) + duration <= now.minutes) appointment.status = n % 5 === 4 ? 'no_asistio' : 'completada'
      n++
    }
  }
  return n
}
