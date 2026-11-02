// Carga citas de ejemplo para hoy y los próximos días. Ejecutar con el servidor detenido:
//   npm run demo
import { addSampleAppointments } from './sample.js'
import { load, save } from './store.js'

const created = addSampleAppointments(load())
save()
console.log(`Se agregaron ${created} citas de ejemplo.`)
