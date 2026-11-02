<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../api'
import Icon from '../components/Icon.vue'
import MonthCalendar from '../components/MonthCalendar.vue'
import SiteFooter from '../components/SiteFooter.vue'
import SiteHeader from '../components/SiteHeader.vue'
import SlotGrid from '../components/SlotGrid.vue'
import { toast } from '../toast'
import { addDays, formatDuration, longDate, money, toHHMM, toMin } from '../utils/format'

const route = useRoute()
const router = useRouter()

const STEPS = ['Corte', 'Adicionales', 'Fecha y hora', 'Tus datos']
const CUSTOMER_KEY = 'amilcar.customer'
const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

const loading = ref(true)
const loadError = ref('')
const config = ref(null)
const services = ref([])
const step = ref(0)
const flowEl = ref(null)

const serviceId = ref('')
const extraIds = ref([])
const date = ref('')
const time = ref('')
const customer = reactive({ name: '', phone: '', email: '', notes: '' })
const errors = reactive({ name: '', phone: '', email: '' })

const days = ref(null)
const daysLoading = ref(false)
const slots = ref([])
const slotsLoading = ref(false)
const slotsMessage = ref('')
const submitting = ref(false)

const cuts = computed(() => services.value.filter((s) => s.type === 'corte'))
const extras = computed(() => services.value.filter((s) => s.type === 'adicional'))
const service = computed(() => cuts.value.find((s) => s.id === serviceId.value))
const chosenExtras = computed(() => extras.value.filter((s) => extraIds.value.includes(s.id)))
const duration = computed(() => (service.value?.duration ?? 0) + chosenExtras.value.reduce((t, s) => t + s.duration, 0))
const total = computed(() => (service.value?.price ?? 0) + chosenExtras.value.reduce((t, s) => t + s.price, 0))
const endTime = computed(() => (time.value ? toHHMM(toMin(time.value) + duration.value) : ''))
const maxDate = computed(() => (config.value ? addDays(config.value.today, config.value.bookingWindowDays - 1) : ''))

const canReach = (i) => i === 0 || (i <= 2 ? !!service.value : !!(service.value && date.value && time.value))
const canNext = computed(() => canReach(step.value + 1) || step.value === 3)
const nextLabel = computed(() => {
  if (step.value === 1 && !extraIds.value.length) return 'Continuar sin extras'
  return step.value === 3 ? 'Confirmar reserva' : 'Continuar'
})

/** "Lun a Vie 10:00–20:00 · Sáb 10:00–18:00" a partir del horario semanal. */
const hoursSummary = computed(() => {
  if (!config.value) return []
  const groups = []
  for (const i of [1, 2, 3, 4, 5, 6, 0]) {
    const d = config.value.schedule[i]
    const key = d.open ? `${d.start}–${d.end}` : null
    const last = groups.at(-1)
    if (last && last.key === key) last.days.push(i)
    else groups.push({ key, days: [i] })
  }
  return groups
    .filter((g) => g.key)
    .map((g) => ({
      days: g.days.length > 1 ? `${DAY_NAMES[g.days[0]]} a ${DAY_NAMES[g.days.at(-1)]}` : DAY_NAMES[g.days[0]],
      hours: g.key,
    }))
})

async function init() {
  loading.value = true
  loadError.value = ''
  try {
    const [c, s] = await Promise.all([api.config(), api.services()])
    config.value = c
    services.value = s
    const preset = route.query.servicio
    if (preset && s.some((x) => x.id === preset && x.type === 'corte')) serviceId.value = preset
    try {
      const saved = JSON.parse(localStorage.getItem(CUSTOMER_KEY) || '{}')
      for (const k of ['name', 'phone', 'email']) if (typeof saved[k] === 'string') customer[k] = saved[k]
    } catch {}
  } catch (e) {
    loadError.value = e.message
  } finally {
    loading.value = false
  }
}
onMounted(init)

function go(i) {
  if (i < 0 || i > 3 || !canReach(i)) return
  step.value = i
  const top = flowEl.value?.getBoundingClientRect().top ?? 0
  if (top < 0) flowEl.value.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function next() {
  if (step.value === 3) submit()
  else if (canNext.value) go(step.value + 1)
}

// ─── Disponibilidad ──────────────────────────────────────────────────────────

async function refreshAvailability() {
  daysLoading.value = true
  try {
    const r = await api.days(duration.value)
    days.value = r.days
    const first = Object.keys(r.days).find((d) => r.days[d] > 0)
    if (!date.value && first) {
      date.value = first // el watcher de la fecha carga las horas
      return
    }
  } catch (e) {
    toast(e.message, 'error')
  } finally {
    daysLoading.value = false
  }
  if (date.value) loadSlots()
}

let slotRequest = 0
async function loadSlots() {
  const id = ++slotRequest
  slotsLoading.value = true
  slotsMessage.value = ''
  try {
    const r = await api.slots(date.value, duration.value)
    if (id !== slotRequest) return
    slots.value = r.slots
    slotsMessage.value = r.closed ? r.reason : r.slots.length ? '' : 'No quedan horas disponibles este día. Prueba con otro.'
    if (time.value && !r.slots.includes(time.value)) time.value = ''
  } catch (e) {
    if (id !== slotRequest) return
    slots.value = []
    slotsMessage.value = e.message
  } finally {
    if (id === slotRequest) slotsLoading.value = false
  }
}

watch(step, (s) => {
  if (s === 2) refreshAvailability()
})
watch(date, (d, prev) => {
  if (prev) time.value = ''
  if (d) loadSlots()
})

// ─── Envío ───────────────────────────────────────────────────────────────────

function validate() {
  errors.name = customer.name.trim().length < 2 ? 'Ingresa tu nombre.' : ''
  const digits = customer.phone.replace(/\D/g, '')
  errors.phone = digits.length < 8 || digits.length > 15 ? 'Ingresa un teléfono válido, por ejemplo +56 9 1234 5678.' : ''
  errors.email = customer.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email.trim()) ? 'Revisa el correo.' : ''
  return !errors.name && !errors.phone && !errors.email
}

async function submit() {
  if (!validate()) return
  submitting.value = true
  try {
    const appointment = await api.book({
      serviceId: serviceId.value,
      extraIds: extraIds.value,
      date: date.value,
      time: time.value,
      customer: { name: customer.name, phone: customer.phone, email: customer.email },
      notes: customer.notes,
    })
    try {
      localStorage.setItem(CUSTOMER_KEY, JSON.stringify({ name: customer.name, phone: customer.phone, email: customer.email }))
    } catch {}
    router.push({ name: 'appointment', params: { code: appointment.code }, query: { nueva: '1' } })
  } catch (e) {
    toast(e.message, 'error', 5000)
    if (e.status === 409) {
      time.value = ''
      go(2)
      refreshAvailability()
    }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="page">
    <SiteHeader :business="config?.business" />

    <section class="hero">
      <div class="container hero-inner">
        <div>
          <p class="eyebrow">Reserva online</p>
          <h1 class="display">Tu próximo corte,<br /><em>sin esperar.</em></h1>
        </div>
        <div class="hero-side">
          <p v-if="config?.business.tagline" class="lead">{{ config.business.tagline }}</p>
          <ul v-if="hoursSummary.length" class="hours tabular">
            <li v-for="h in hoursSummary" :key="h.days">
              <span>{{ h.days }}</span><span>{{ h.hours }}</span>
            </li>
          </ul>
        </div>
      </div>
    </section>
    <div class="pole" aria-hidden="true" />

    <main class="container main">
      <div v-if="loading" class="state">
        <span class="spinner" />
        <span>Cargando servicios…</span>
      </div>

      <div v-else-if="loadError" class="state empty">
        <Icon name="alert" :size="28" />
        <strong>No pudimos cargar la página</strong>
        <span>{{ loadError }}</span>
        <button type="button" class="btn btn-outline btn-sm" @click="init">Reintentar</button>
      </div>

      <div v-else class="layout">
        <div ref="flowEl" class="flow">
          <ol class="stepper">
            <li v-for="(label, i) in STEPS" :key="label">
              <button
                type="button"
                :class="{ active: step === i, done: i < step }"
                :disabled="!canReach(i)"
                :aria-current="step === i ? 'step' : undefined"
                @click="go(i)"
              >
                <span class="num tabular">
                  <Icon v-if="i < step" name="check" :size="13" :stroke="2.6" />
                  <template v-else>{{ String(i + 1).padStart(2, '0') }}</template>
                </span>
                <span class="lbl">{{ label }}</span>
              </button>
            </li>
          </ol>

          <!-- 1 · Corte -->
          <section v-if="step === 0" class="panel">
            <header class="panel-head">
              <h2 class="display">Elige tu corte</h2>
              <p class="muted">Selecciona el servicio principal de tu visita.</p>
            </header>
            <div v-if="cuts.length" class="options" role="radiogroup" aria-label="Corte">
              <label v-for="s in cuts" :key="s.id" class="option" :class="{ selected: serviceId === s.id }">
                <input v-model="serviceId" type="radio" class="sr-only" name="corte" :value="s.id" />
                <span class="opt-top">
                  <strong>{{ s.name }}</strong>
                  <span class="opt-price tabular">{{ money(s.price) }}</span>
                </span>
                <span v-if="s.description" class="opt-desc">{{ s.description }}</span>
                <span class="opt-meta"><Icon name="clock" :size="14" />{{ formatDuration(s.duration) }}</span>
                <span class="opt-check" aria-hidden="true"><Icon name="check" :size="13" :stroke="2.6" /></span>
              </label>
            </div>
            <div v-else class="empty card">
              <Icon name="scissors" :size="26" />
              <strong>Por ahora no hay servicios disponibles</strong>
              <span>Vuelve a intentarlo más tarde.</span>
            </div>
          </section>

          <!-- 2 · Adicionales -->
          <section v-else-if="step === 1" class="panel">
            <header class="panel-head">
              <h2 class="display">Suma algo extra</h2>
              <p class="muted">Opcional. Puedes elegir más de uno.</p>
            </header>
            <div v-if="extras.length" class="options">
              <label v-for="s in extras" :key="s.id" class="option" :class="{ selected: extraIds.includes(s.id) }">
                <input v-model="extraIds" type="checkbox" class="sr-only" :value="s.id" />
                <span class="opt-top">
                  <strong>{{ s.name }}</strong>
                  <span class="opt-price tabular">+ {{ money(s.price) }}</span>
                </span>
                <span v-if="s.description" class="opt-desc">{{ s.description }}</span>
                <span class="opt-meta"><Icon name="clock" :size="14" />+ {{ formatDuration(s.duration) }}</span>
                <span class="opt-check" aria-hidden="true"><Icon name="check" :size="13" :stroke="2.6" /></span>
              </label>
            </div>
            <div v-else class="empty card">
              <strong>No hay servicios adicionales por ahora</strong>
              <span>Continúa para elegir tu hora.</span>
            </div>
          </section>

          <!-- 3 · Fecha y hora -->
          <section v-else-if="step === 2" class="panel">
            <header class="panel-head">
              <h2 class="display">¿Cuándo vienes?</h2>
              <p class="muted">Tu visita dura aprox. {{ formatDuration(duration) }}. Los días marcados con un punto tienen horas libres.</p>
            </header>
            <div class="when">
              <div class="card when-card">
                <MonthCalendar v-model="date" :today="config.today" :max="maxDate" :availability="days" :loading="daysLoading" />
              </div>
              <div class="card when-card">
                <p class="when-title">{{ date ? longDate(date) : 'Elige un día' }}</p>
                <SlotGrid v-model="time" :slots="slots" :loading="slotsLoading || daysLoading" :message="slotsMessage" />
                <p v-if="time" class="when-hint"><Icon name="clock" :size="15" />Terminas aprox. a las {{ endTime }}</p>
              </div>
            </div>
          </section>

          <!-- 4 · Datos -->
          <section v-else class="panel">
            <header class="panel-head">
              <h2 class="display">Tus datos</h2>
              <p class="muted">Solo los usamos para confirmar tu hora o avisarte si hay algún cambio.</p>
            </header>
            <form class="form card" novalidate @submit.prevent="submit">
              <label class="field">
                <span class="label">Nombre y apellido</span>
                <input v-model="customer.name" class="input" :class="{ invalid: errors.name }" autocomplete="name" maxlength="80" />
                <span v-if="errors.name" class="field-error"><Icon name="alert" :size="14" />{{ errors.name }}</span>
              </label>
              <label class="field">
                <span class="label">Teléfono / WhatsApp</span>
                <input
                  v-model="customer.phone"
                  class="input"
                  :class="{ invalid: errors.phone }"
                  type="tel"
                  inputmode="tel"
                  autocomplete="tel"
                  placeholder="+56 9 1234 5678"
                  maxlength="24"
                />
                <span v-if="errors.phone" class="field-error"><Icon name="alert" :size="14" />{{ errors.phone }}</span>
              </label>
              <label class="field full">
                <span class="label">Correo <small>(opcional)</small></span>
                <input v-model="customer.email" class="input" :class="{ invalid: errors.email }" type="email" autocomplete="email" maxlength="120" />
                <span v-if="errors.email" class="field-error"><Icon name="alert" :size="14" />{{ errors.email }}</span>
              </label>
              <label class="field full">
                <span class="label">Comentarios <small>(opcional)</small></span>
                <textarea v-model="customer.notes" class="input" maxlength="300" placeholder="Ej: quiero el mismo corte de la última vez." />
              </label>
              <button type="submit" class="sr-only" tabindex="-1">Confirmar</button>
            </form>
          </section>

          <div class="actions">
            <button v-if="step > 0" type="button" class="btn btn-outline back" @click="go(step - 1)">
              <Icon name="arrow-left" /><span>Atrás</span>
            </button>
            <div class="actions-total">
              <strong class="tabular">{{ money(total) }}</strong>
              <span>{{ formatDuration(duration) }}</span>
            </div>
            <button type="button" class="btn next" :disabled="!canNext || submitting" @click="next">
              <span v-if="submitting" class="spinner" />
              <span>{{ submitting ? 'Reservando…' : nextLabel }}</span>
              <Icon v-if="!submitting" :name="step === 3 ? 'check' : 'arrow-right'" />
            </button>
          </div>
        </div>

        <aside class="summary" :class="{ 'show-mobile': step === 3 }" aria-label="Resumen de tu reserva">
          <div class="sum-card">
            <div class="pole" aria-hidden="true" />
            <div class="sum-body">
              <p class="eyebrow">Tu reserva</p>
              <ul class="sum-items">
                <li v-if="service">
                  <span>{{ service.name }}</span><span class="tabular">{{ money(service.price) }}</span>
                </li>
                <li v-else class="placeholder">Aún no eliges un corte</li>
                <li v-for="e in chosenExtras" :key="e.id" class="extra">
                  <span>+ {{ e.name }}</span><span class="tabular">{{ money(e.price) }}</span>
                </li>
              </ul>
              <div class="sum-when">
                <span><Icon name="calendar" :size="16" />{{ date && step >= 2 ? longDate(date) : 'Fecha por elegir' }}</span>
                <span class="tabular"><Icon name="clock" :size="16" />{{ time ? `${time} – ${endTime}` : 'Hora por elegir' }}</span>
              </div>
              <div class="sum-total">
                <span>Total</span>
                <strong class="tabular">{{ money(total) }}</strong>
              </div>
              <p class="sum-note">
                <template v-if="service">Duración aprox. {{ formatDuration(duration) }} · </template>El pago se realiza en la barbería.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </main>

    <SiteFooter :business="config?.business" />
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
.main {
  flex: 1;
}

/* Hero */
.hero {
  background: var(--black);
  color: var(--paper);
  border-top: 1px solid #222;
}
.hero-inner {
  display: grid;
  grid-template-columns: 1.3fr 1fr;
  align-items: end;
  gap: 32px;
  padding-top: 56px;
  padding-bottom: 52px;
}
.hero .eyebrow {
  color: var(--ink-4);
  margin-bottom: 16px;
}
.hero h1 {
  font-size: clamp(40px, 6.4vw, 76px);
  line-height: 0.98;
  letter-spacing: -0.03em;
}
.hero h1 em {
  font-weight: 400;
}
.hero-side {
  display: grid;
  gap: 18px;
  justify-items: start;
}
.lead {
  max-width: 36ch;
  color: #cfcfcf;
  font-size: 16px;
}
.hours {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 14px 0 0;
  border-top: 1px solid #333;
  list-style: none;
  font-size: 13px;
  min-width: 240px;
}
.hours li {
  display: flex;
  justify-content: space-between;
  gap: 24px;
}
.hours li span:first-child {
  color: var(--ink-4);
}

/* Layout */
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
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  align-items: start;
  gap: 40px;
  padding-top: 36px;
}

/* Stepper */
.stepper {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  margin: 0 0 30px;
  padding: 0;
  list-style: none;
}
.stepper button {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 12px 0 0;
  border: none;
  border-top: 2px solid var(--line);
  background: none;
  color: var(--ink-4);
  font-size: 13px;
  font-weight: 700;
  text-align: left;
  cursor: pointer;
  transition:
    color 0.2s,
    border-color 0.2s;
}
.stepper button:disabled {
  cursor: default;
}
.stepper button.done {
  border-color: var(--ink-3);
  color: var(--ink-2);
}
.stepper button.active {
  border-color: var(--black);
  color: var(--black);
}
.num {
  display: inline-grid;
  place-items: center;
  width: 26px;
  height: 26px;
  flex: none;
  border: 1.5px solid currentColor;
  border-radius: 50%;
  font-size: 11px;
}
.active .num {
  background: var(--black);
  border-color: var(--black);
  color: var(--paper);
}

/* Paneles */
.panel-head {
  margin-bottom: 20px;
}
.panel-head h2 {
  font-size: clamp(28px, 3.6vw, 38px);
  margin-bottom: 6px;
}

.options {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}
.option {
  position: relative;
  display: grid;
  align-content: start;
  gap: 6px;
  min-height: 132px;
  padding: 18px 18px 16px;
  border: 1px solid var(--line-2);
  border-radius: var(--radius);
  background: var(--paper);
  cursor: pointer;
  transition:
    background 0.18s,
    color 0.18s,
    border-color 0.18s,
    transform 0.18s var(--ease),
    box-shadow 0.18s;
}
.option:hover {
  border-color: var(--black);
  transform: translateY(-1px);
  box-shadow: var(--shadow);
}
.option:has(input:focus-visible) {
  outline: 2px solid var(--black);
  outline-offset: 3px;
}
.option.selected {
  border-color: var(--black);
  background: var(--black);
  color: var(--paper);
}
.opt-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}
.opt-top strong {
  font-size: 16px;
  font-weight: 800;
}
.opt-price {
  font-family: var(--font-display);
  font-size: 19px;
  font-weight: 600;
  white-space: nowrap;
}
.opt-desc {
  color: var(--ink-3);
  font-size: 13.5px;
  padding-right: 24px;
}
.option.selected .opt-desc {
  color: #bdbdbd;
}
.opt-meta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: auto;
  padding-top: 8px;
  font-size: 12.5px;
  font-weight: 700;
}
.opt-check {
  position: absolute;
  right: 16px;
  bottom: 14px;
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border: 1.5px solid var(--line-2);
  border-radius: 50%;
  color: transparent;
  transition: all 0.18s;
}
.option.selected .opt-check {
  border-color: var(--paper);
  background: var(--paper);
  color: var(--black);
}

/* Fecha y hora */
.when {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 14px;
  align-items: start;
}
.when-card {
  padding: 18px;
}
.when-title {
  margin-bottom: 16px;
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 600;
}
.when-hint {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--line);
  font-size: 13.5px;
  font-weight: 600;
}

/* Datos */
.form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
  padding: 22px;
}
.form .full {
  grid-column: 1 / -1;
}

/* Acciones */
.actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 26px;
}
.actions .next {
  margin-left: auto;
  min-width: 200px;
}
.actions-total {
  display: none;
}

/* Resumen */
.summary {
  position: sticky;
  top: 24px;
}
.sum-card {
  overflow: hidden;
  border-radius: var(--radius);
  background: var(--black);
  color: var(--paper);
  box-shadow: var(--shadow);
}
.sum-card .pole {
  height: 6px;
  background: repeating-linear-gradient(-45deg, var(--paper) 0 7px, var(--black) 7px 14px);
}
.sum-body {
  padding: 22px;
}
.sum-body .eyebrow {
  color: var(--ink-4);
  margin-bottom: 14px;
}
.sum-items {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0 0 16px;
  border-bottom: 1px solid #2c2c2c;
  list-style: none;
  font-size: 14px;
}
.sum-items li {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
.sum-items li:first-child {
  font-weight: 700;
}
.sum-items .extra {
  color: #c4c4c4;
  font-size: 13.5px;
}
.sum-items .placeholder {
  color: var(--ink-3);
  font-weight: 500;
}
.sum-when {
  display: grid;
  gap: 8px;
  padding: 16px 0;
  border-bottom: 1px solid #2c2c2c;
  font-size: 14px;
}
.sum-when span {
  display: flex;
  align-items: center;
  gap: 10px;
}
.sum-total {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding-top: 16px;
}
.sum-total span {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ink-4);
}
.sum-total strong {
  font-family: var(--font-display);
  font-size: 34px;
  font-weight: 600;
}
.sum-note {
  margin-top: 8px;
  color: var(--ink-4);
  font-size: 12.5px;
}

/* Responsive */
@media (max-width: 960px) {
  .layout {
    grid-template-columns: 1fr;
    gap: 24px;
  }
  .summary {
    display: none;
    position: static;
    order: -1;
  }
  .summary.show-mobile {
    display: block;
  }
  .hero-inner {
    grid-template-columns: 1fr;
    gap: 22px;
    padding-top: 40px;
    padding-bottom: 36px;
  }
}

@media (max-width: 720px) {
  .hero-inner {
    gap: 16px;
    padding-top: 28px;
    padding-bottom: 26px;
  }
  .hero .eyebrow {
    margin-bottom: 10px;
  }
  .hero h1 {
    font-size: 38px;
  }
  .lead {
    font-size: 14.5px;
  }
  .hours {
    padding-top: 10px;
    font-size: 12.5px;
  }
  .layout {
    padding-top: 24px;
  }
  .when,
  .form {
    grid-template-columns: 1fr;
  }
  .stepper {
    margin-bottom: 22px;
  }
  .stepper .lbl {
    display: none;
  }
  .stepper .active .lbl {
    display: inline;
  }
  .stepper li:has(.active) {
    grid-column: span 1;
  }
  .stepper {
    grid-template-columns: auto auto auto auto;
    justify-content: start;
    column-gap: 14px;
  }
  .stepper button {
    border-top: none;
    padding-top: 0;
  }
  .actions {
    position: sticky;
    bottom: 0;
    z-index: 5;
    margin: 22px -20px 0;
    padding: 12px 20px calc(12px + env(safe-area-inset-bottom));
    border-top: 1px solid var(--line);
    background: rgb(255 255 255 / 0.96);
    backdrop-filter: blur(8px);
  }
  .actions .back span {
    display: none;
  }
  .actions .back {
    width: 46px;
    padding: 0;
  }
  .actions-total {
    display: grid;
    line-height: 1.15;
  }
  .actions-total strong {
    font-family: var(--font-display);
    font-size: 20px;
  }
  .actions-total span {
    color: var(--ink-3);
    font-size: 12px;
  }
  .actions .next {
    min-width: 0;
    flex: 0 1 auto;
  }
  .options {
    grid-template-columns: 1fr;
  }
  .option {
    min-height: 0;
  }
}
</style>
