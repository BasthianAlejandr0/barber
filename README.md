# Amílcar Barbero · Agendamiento de horas

Web de reservas en blanco y negro para la barbería. Tiene dos partes:

- **Página de reservas** (`/`): es el enlace que se comparte con los clientes. El cliente elige su corte, suma
  servicios adicionales, ve en un calendario los días y las horas libres, deja sus datos y recibe un comprobante con un
  enlace propio (`/cita/CÓDIGO`) para agregarlo a su calendario o cancelar.
- **Panel del barbero** (`/admin`): resumen del día, agenda por día (línea de tiempo) o en lista, creación de citas
  manuales, reagendar, marcar como completada / no asistió / cancelada, catálogo de cortes y adicionales, horario
  semanal con pausas, reglas de reserva, días libres y bloqueos, y el enlace + código QR para compartir.

## ¿Por qué Vue + Express?

Vue arma la interfaz. **Express es necesario**: sin un servidor cada navegador guardaría sus propias citas, el barbero no
vería lo que reservan los clientes, nada impediría que dos personas tomen la misma hora y el panel no tendría
contraseña. El servidor guarda todo en `server/data/db.json` (sin base de datos que instalar) y valida cada reserva
antes de aceptarla.

## Puesta en marcha

Requiere Node.js 22.9 o superior.

```bash
npm install
```

```bash
npm run dev
```

- Página de reservas: http://localhost:5173
- Panel: http://localhost:5173/admin — contraseña por defecto `amilcar2026`

### Cambiar la contraseña

Copia `.env.example` como `.env` y define `ADMIN_PASSWORD`. Reinicia el servidor después de cambiarla.

## Producción

```bash
npm run build
```

```bash
npm start
```

Express sirve la app compilada y la API en el mismo puerto (`PORT`, por defecto 3001). Respalda periódicamente
`server/data/db.json`: ahí están todas las citas.

## Demo en GitHub Pages

https://basthianalejandr0.github.io/barber/

GitHub Pages solo sirve archivos estáticos, así que esa versión no usa Express: las mismas rutas de `server/routes`
corren en el navegador (`src/demo/`) y los datos se guardan en el `localStorage` de cada visitante. Sirve para mostrar la
app, pero **las reservas no le llegan al barbero**; para usarla con clientes reales hay que publicar el servidor (ver
Producción). La contraseña de la demo es `amilcar2026` y el botón «Reiniciar datos» vuelve a las citas de ejemplo.

Se publica sola en cada push a `main` (`.github/workflows/pages.yml`). Para probarla en local:

```bash
npm run build:pages
```

```bash
npm run preview:pages
```

## Datos de ejemplo

Los datos actuales incluyen 30 citas de ejemplo para que veas el panel con movimiento. Con el servidor **detenido**:

```bash
npm run reset
```

borra todo y vuelve a los servicios y horario iniciales; `npm run demo` vuelve a cargar citas de ejemplo.

## Estructura

```
server/
  index.js          Servidor Express (API + archivos de Vue en producción)
  routes/public.js  API pública: servicios, horas libres, reservar, ver/cancelar con código
  routes/admin.js   API del panel (requiere sesión)
  availability.js   Cálculo de horas libres (horario, pausa, bloqueos, citas, anticipación)
  appointments.js   Validación y creación de citas
  store.js          Lectura/escritura de db.json
  sample.js         Citas de ejemplo (npm run demo y la demo de Pages)
src/
  demo/                      Backend en el navegador para GitHub Pages
  views/BookingView.vue      Flujo de reserva del cliente
  views/AppointmentView.vue  Comprobante y cancelación
  views/admin/               Panel: resumen, agenda, servicios, ajustes
  components/                Calendario, grilla de horas, modales, etc.
```

## Reglas de disponibilidad

- Se ofrecen horas cada N minutos (ajustable) dentro del horario de cada día, más las horas en que termina otra cita
  para no dejar huecos.
- Una hora se ofrece solo si **todo el servicio** (corte + adicionales) cabe antes del cierre y no se cruza con la
  pausa, un bloqueo u otra cita.
- Los clientes respetan la anticipación mínima y la ventana de días; desde el panel se puede agendar sin esas
  restricciones o con hora manual.
- Las citas canceladas liberan la hora.
