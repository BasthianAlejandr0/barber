// Se usa el crypto global (Node y navegador) para que la versión demo de GitHub Pages reutilice esta lógica.
export const newId = (prefix) => `${prefix}_${crypto.randomUUID().replaceAll('-', '').slice(0, 10)}`

const service = (type, name, description, price, duration) => ({
  id: newId('svc'),
  type,
  name,
  description,
  price,
  duration,
  active: true,
})

const day = (open, start, end, breakStart = '', breakEnd = '') => ({ open, start, end, breakStart, breakEnd })

/** Datos iniciales con los que arranca la barbería la primera vez. */
export function createSeed() {
  return {
    version: 1,
    settings: {
      business: {
        name: 'Amílcar Barbero',
        tagline: 'Cortes clásicos y modernos, con navaja y buena conversación.',
        address: '',
        phone: '',
        instagram: '',
      },
      timezone: process.env.TIMEZONE || 'America/Santiago',
      slotInterval: 30,
      bookingWindowDays: 30,
      minNoticeMinutes: 60,
      // Índice = día de la semana (0 domingo … 6 sábado)
      schedule: [
        day(false, '10:00', '14:00'),
        day(true, '10:00', '20:00', '14:00', '15:00'),
        day(true, '10:00', '20:00', '14:00', '15:00'),
        day(true, '10:00', '20:00', '14:00', '15:00'),
        day(true, '10:00', '20:00', '14:00', '15:00'),
        day(true, '10:00', '20:00', '14:00', '15:00'),
        day(true, '10:00', '18:00'),
      ],
    },
    services: [
      service('corte', 'Corte clásico', 'Tijera y máquina, terminación con navaja.', 10000, 30),
      service('corte', 'Fade / degradado', 'Degradado bajo, medio o alto a elección.', 12000, 40),
      service('corte', 'Corte + barba', 'Corte completo y arreglo de barba con toalla caliente.', 16000, 60),
      service('corte', 'Rapado a máquina', 'Un solo número parejo en toda la cabeza.', 7000, 20),
      service('corte', 'Corte infantil', 'Para niños hasta 12 años.', 8000, 30),
      service('adicional', 'Perfilado de barba', 'Contorno y forma con navaja.', 5000, 15),
      service('adicional', 'Lavado de cabello', 'Lavado con masaje capilar.', 3000, 10),
      service('adicional', 'Diseño / líneas', 'Líneas o figuras con máquina.', 3000, 10),
      service('adicional', 'Perfilado de cejas', 'Limpieza y forma de cejas.', 2000, 10),
      service('adicional', 'Toalla caliente', 'Ritual de toalla caliente y aceites.', 4000, 15),
      service('adicional', 'Mascarilla negra', 'Limpieza facial con mascarilla de carbón.', 5000, 15),
    ],
    appointments: [],
    blocks: [],
  }
}
