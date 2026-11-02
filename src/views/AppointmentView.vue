<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../api'
import BrandMark from '../components/BrandMark.vue'
import Icon from '../components/Icon.vue'
import SiteFooter from '../components/SiteFooter.vue'
import SiteHeader from '../components/SiteHeader.vue'
import { confirmDialog } from '../confirm'
import { toast } from '../toast'
import { firstName, formatDuration, fullDate, money } from '../utils/format'

const route = useRoute()
const router = useRouter()
const code = computed(() => String(route.params.code).toUpperCase())
const isNew = computed(() => route.query.nueva === '1')
const link = computed(() => new URL(router.resolve(`/cita/${code.value}`).href, location.href).href)

const appointment = ref(null)
const config = ref(null)
const loading = ref(true)
const error = ref('')
const cancelling = ref(false)

onMounted(async () => {
  try {
    const [c, a] = await Promise.all([api.config(), api.appointment(code.value)])
    config.value = c
    appointment.value = a
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})

const businessName = computed(() => config.value?.business.name || 'Amílcar Barbero')

const heading = computed(() => {
  const a = appointment.value
  if (!a) return ''
  if (a.status === 'cancelada') return 'Esta reserva fue cancelada'
  if (a.status === 'completada') return '¡Gracias por tu visita!'
  if (a.status === 'no_asistio') return 'Reserva no asistida'
  return isNew.value ? `¡Listo, ${firstName(a.customer.name)}! Tu hora está reservada.` : 'Tu reserva'
})

async function cancel() {
  const a = appointment.value
  const ok = await confirmDialog({
    title: '¿Cancelar tu hora?',
    message: `Liberaremos tu hora del ${fullDate(a.date).toLowerCase()} a las ${a.time}. Si quieres venir otro día, puedes reservar de nuevo.`,
    confirmText: 'Sí, cancelar',
    cancelText: 'Mantener mi hora',
  })
  if (!ok) return
  cancelling.value = true
  try {
    appointment.value = await api.cancel(code.value)
    toast('Tu hora fue cancelada.')
  } catch (e) {
    toast(e.message, 'error')
  } finally {
    cancelling.value = false
  }
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(link.value)
    toast('Enlace copiado.')
  } catch {
    toast('No pudimos copiar el enlace.', 'error')
  }
}

// ─── Agregar al calendario ──────────────────────────────────────────────────

const stamp = (d, t) => `${d.replaceAll('-', '')}T${t.replace(':', '')}00`
const eventTitle = computed(() => `${appointment.value.service.name} · ${businessName.value}`)
const eventDetails = computed(() => `Código de reserva: ${appointment.value.code}\nVer o cancelar: ${link.value}`)

const googleUrl = computed(() => {
  const a = appointment.value
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: eventTitle.value,
    dates: `${stamp(a.date, a.time)}/${stamp(a.date, a.end)}`,
    ctz: config.value.timezone,
    details: eventDetails.value,
    location: config.value.business.address || '',
  })
  return `https://calendar.google.com/calendar/render?${params}`
})

function downloadIcs() {
  const a = appointment.value
  const esc = (s) => s.replace(/[\\,;]/g, (c) => `\\${c}`).replace(/\n/g, '\\n')
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Amilcar Barbero//Reservas//ES',
    'BEGIN:VEVENT',
    `UID:${a.code}@amilcar-barbero`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
    `DTSTART:${stamp(a.date, a.time)}`,
    `DTEND:${stamp(a.date, a.end)}`,
    `SUMMARY:${esc(eventTitle.value)}`,
    `DESCRIPTION:${esc(eventDetails.value)}`,
    config.value.business.address ? `LOCATION:${esc(config.value.business.address)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n')
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }))
  const el = Object.assign(document.createElement('a'), { href: url, download: `reserva-${a.code}.ics` })
  el.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Código de barras decorativo derivado del código de reserva.
const bars = computed(() =>
  [...(appointment.value?.code || '')].flatMap((ch, i) => {
    const n = ch.charCodeAt(0) * (i + 7)
    return [1 + (n % 3), 1 + ((n >> 2) % 2), 1 + ((n >> 3) % 3), 1 + ((n >> 1) % 2), 2 + (n % 2), 1]
  }),
)
</script>

<template>
  <div class="page">
    <SiteHeader :business="config?.business" />

    <main class="container main">
      <div v-if="loading" class="state"><span class="spinner" /> Buscando tu reserva…</div>

      <div v-else-if="error" class="state empty">
        <Icon name="search" :size="28" />
        <strong>{{ error }}</strong>
        <span>Revisa que el enlace esté completo.</span>
        <RouterLink to="/" class="btn btn-sm">Reservar una hora</RouterLink>
      </div>

      <template v-else>
        <header class="head" :class="appointment.status">
          <span v-if="isNew && appointment.status === 'confirmada'" class="seal" aria-hidden="true"><Icon name="check" :size="26" :stroke="2.4" /></span>
          <h1 class="display">{{ heading }}</h1>
          <p v-if="appointment.status === 'confirmada'" class="muted">
            Guarda este enlace: desde aquí puedes revisar o cancelar tu hora.
          </p>
        </header>

        <article class="ticket" :class="{ void: appointment.status === 'cancelada' }">
          <div class="t-top">
            <BrandMark :name="businessName" inverse size="sm" />
            <span class="t-code tabular">Nº {{ appointment.code }}</span>
          </div>

          <div class="t-main">
            <p class="eyebrow">Fecha</p>
            <p class="t-date">{{ fullDate(appointment.date) }}</p>
            <p class="t-time tabular">{{ appointment.time }}<span>–</span>{{ appointment.end }}</p>
            <p class="t-dur">{{ formatDuration(appointment.duration) }} aprox.</p>
          </div>

          <div class="perforation" aria-hidden="true" />

          <div class="t-items">
            <div class="row">
              <span>{{ appointment.service.name }}</span>
              <span class="tabular">{{ money(appointment.service.price) }}</span>
            </div>
            <div v-for="e in appointment.extras" :key="e.id" class="row extra">
              <span>+ {{ e.name }}</span>
              <span class="tabular">{{ money(e.price) }}</span>
            </div>
            <div class="row total">
              <span>Total</span>
              <strong class="tabular">{{ money(appointment.total) }}</strong>
            </div>
            <p v-if="appointment.notes" class="t-notes">“{{ appointment.notes }}”</p>
          </div>

          <div class="t-foot">
            <div class="barcode" aria-hidden="true">
              <span v-for="(w, i) in bars" :key="i" :style="{ flexGrow: w, opacity: i % 2 ? 0 : 1 }" />
            </div>
            <p v-if="config.business.address" class="t-addr"><Icon name="pin" :size="14" />{{ config.business.address }}</p>
            <p class="t-name">A nombre de {{ appointment.customer.name }}</p>
          </div>

          <span v-if="appointment.status === 'cancelada'" class="stamp" aria-hidden="true">Cancelada</span>
        </article>

        <div class="actions">
          <template v-if="appointment.status === 'confirmada'">
            <a :href="googleUrl" target="_blank" rel="noopener" class="btn"><Icon name="calendar" />Google Calendar</a>
            <button type="button" class="btn btn-outline" @click="downloadIcs"><Icon name="download" />Apple / Outlook</button>
            <button type="button" class="btn btn-outline" @click="copyLink"><Icon name="link" />Copiar enlace</button>
          </template>
          <RouterLink v-else to="/" class="btn">Reservar otra hora</RouterLink>
        </div>

        <div v-if="appointment.cancellable" class="cancel">
          <span>¿No puedes venir?</span>
          <button type="button" class="link-btn" :disabled="cancelling" @click="cancel">
            {{ cancelling ? 'Cancelando…' : 'Cancelar mi hora' }}
          </button>
        </div>
        <p v-if="appointment.status === 'confirmada'" class="again">
          <RouterLink to="/">Reservar otra hora</RouterLink>
        </p>
      </template>
    </main>

    <SiteFooter :business="config?.business" />
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--paper-2);
}
.main {
  flex: 1;
  max-width: 620px;
  padding-top: 48px;
}
.state {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  padding: 80px 0;
  color: var(--ink-3);
}
.state.empty {
  display: grid;
}

.head {
  display: grid;
  justify-items: center;
  gap: 10px;
  margin-bottom: 30px;
  text-align: center;
}
.head h1 {
  max-width: 18ch;
  font-size: clamp(30px, 5vw, 44px);
  line-height: 1.05;
}
.seal {
  display: grid;
  place-items: center;
  width: 60px;
  height: 60px;
  margin-bottom: 6px;
  border-radius: 50%;
  background: var(--black);
  color: var(--paper);
  outline: 1.5px solid var(--black);
  outline-offset: 4px;
  animation: pop 0.5s var(--ease) both;
}
@keyframes pop {
  from {
    transform: scale(0.6);
    opacity: 0;
  }
}

/* Ticket */
.ticket {
  position: relative;
  overflow: hidden;
  border: 1.5px solid var(--black);
  border-radius: 20px;
  background: var(--paper);
  box-shadow: var(--shadow);
}
.ticket.void > *:not(.stamp) {
  opacity: 0.45;
}
.t-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 22px;
  background: var(--black);
  color: var(--paper);
}
.t-code {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.14em;
}
.t-main {
  padding: 26px 26px 22px;
}
.t-main .eyebrow {
  margin-bottom: 6px;
}
.t-date {
  font-size: 17px;
  font-weight: 700;
}
.t-time {
  margin-top: 2px;
  font-family: var(--font-display);
  font-size: clamp(44px, 9vw, 60px);
  font-weight: 500;
  line-height: 1.05;
  letter-spacing: -0.02em;
}
.t-time span {
  margin: 0 0.18em;
  color: var(--ink-4);
}
.t-dur {
  color: var(--ink-3);
  font-size: 13.5px;
}
.perforation {
  position: relative;
  height: 0;
  margin: 0 22px;
  border-top: 2px dashed var(--line-2);
}
.perforation::before,
.perforation::after {
  content: '';
  position: absolute;
  top: -13px;
  width: 24px;
  height: 24px;
  border: 1.5px solid var(--black);
  border-radius: 50%;
  background: var(--paper-2);
}
.perforation::before {
  left: -36px;
}
.perforation::after {
  right: -36px;
}
.t-items {
  display: grid;
  gap: 8px;
  padding: 22px 26px;
  font-size: 14.5px;
}
.row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}
.row.extra {
  color: var(--ink-3);
}
.row.total {
  margin-top: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--line);
  align-items: baseline;
  font-weight: 700;
}
.row.total strong {
  font-family: var(--font-display);
  font-size: 28px;
  font-weight: 600;
}
.t-notes {
  margin-top: 6px;
  color: var(--ink-3);
  font-size: 13.5px;
  font-style: italic;
}
.t-foot {
  display: grid;
  gap: 8px;
  padding: 18px 26px 24px;
  background: var(--paper-2);
  border-top: 1px solid var(--line);
}
.barcode {
  display: flex;
  max-width: 300px;
  height: 40px;
}
.barcode span {
  width: 0;
  height: 100%;
  background: var(--black);
}
.t-addr,
.t-name {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--ink-3);
  font-size: 12.5px;
}
.stamp {
  position: absolute;
  top: 44%;
  left: 50%;
  padding: 6px 18px;
  border: 3px solid var(--black);
  border-radius: 8px;
  color: var(--black);
  font-size: 26px;
  font-weight: 800;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  transform: translate(-50%, -50%) rotate(-12deg);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  margin-top: 26px;
}
.cancel {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-top: 26px;
  color: var(--ink-3);
  font-size: 14px;
}
.link-btn {
  padding: 0;
  border: none;
  background: none;
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}
.again {
  margin-top: 10px;
  text-align: center;
  font-size: 14px;
  font-weight: 700;
}
.again a {
  text-underline-offset: 3px;
}
@media (max-width: 520px) {
  .actions .btn {
    flex: 1 1 100%;
  }
}
</style>
