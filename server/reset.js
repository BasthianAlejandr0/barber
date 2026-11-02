// Borra todos los datos y vuelve a los servicios y horarios iniciales.
// Ejecutar con el servidor detenido:  npm run reset
import fs from 'node:fs'
import { DB_FILE, load } from './store.js'

fs.rmSync(DB_FILE, { force: true })
load()
console.log('Datos reiniciados.')
