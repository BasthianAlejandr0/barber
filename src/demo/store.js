// Versión demo de server/store.js: los datos viven en el localStorage del navegador.
import { addSampleAppointments } from '../../server/sample.js'
import { createSeed } from '../../server/seed.js'

const KEY = 'amilcar.demo.db'
let db = null

export function load() {
  let data = null
  try {
    data = JSON.parse(localStorage.getItem(KEY))
  } catch {}
  if (data) {
    const seed = createSeed()
    db = {
      ...seed,
      ...data,
      settings: { ...seed.settings, ...data.settings, business: { ...seed.settings.business, ...data.settings?.business } },
    }
  } else if (!db) {
    // Primera visita: se arranca con citas de ejemplo para que el panel no aparezca vacío.
    db = createSeed()
    addSampleAppointments(db)
    save()
  }
  return db
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db))
  } catch {
    // Sin localStorage (modo privado estricto) los datos quedan solo en memoria.
  }
}

export function reset() {
  try {
    localStorage.removeItem(KEY)
  } catch {}
  db = null
}

export const getDb = () => db
