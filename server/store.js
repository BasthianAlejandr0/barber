// Persistencia en un archivo JSON. Todas las lecturas y escrituras son
// síncronas, así que cada petición ve y modifica el estado completo sin
// carreras (dos clientes no pueden tomar la misma hora a la vez).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createSeed } from './seed.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'))
export const DB_FILE = path.join(DATA_DIR, 'db.json')

let db = null

export function load() {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  if (fs.existsSync(DB_FILE)) {
    const seed = createSeed()
    const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'))
    db = {
      ...seed,
      ...data,
      settings: { ...seed.settings, ...data.settings, business: { ...seed.settings.business, ...data.settings?.business } },
    }
  } else {
    db = createSeed()
    save()
  }
  return db
}

export function save() {
  const json = JSON.stringify(db, null, 2)
  const tmp = `${DB_FILE}.tmp`
  try {
    fs.writeFileSync(tmp, json)
    fs.renameSync(tmp, DB_FILE)
  } catch {
    // En Windows el rename puede fallar si otro proceso tiene el archivo abierto.
    fs.writeFileSync(DB_FILE, json)
  }
}

export const getDb = () => db
