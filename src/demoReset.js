import { resetDemo } from './api'
import { confirmDialog } from './confirm'

/** Solo en la demo de GitHub Pages: vuelve a los datos de ejemplo de este navegador. */
export async function confirmResetDemo() {
  const ok = await confirmDialog({
    title: '¿Reiniciar la demo?',
    message: 'Se borran las reservas y cambios hechos en este navegador y se cargan citas de ejemplo nuevas.',
    confirmText: 'Reiniciar',
  })
  if (!ok) return
  await resetDemo()
  location.reload()
}
