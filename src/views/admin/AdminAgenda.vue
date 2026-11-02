<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { admin } from '../../api'
import AppointmentDetail from '../../components/AppointmentDetail.vue'
import AppointmentForm from '../../components/AppointmentForm.vue'
import Icon from '../../components/Icon.vue'
import StatusBadge from '../../components/StatusBadge.vue'
import { useConfig } from '../../stores/config'
import { toast } from '../../toast'
import { STATUS_LABEL, addDays, dayName, fullDate, longDate, money, nowIn, startOfWeek, toHHMM, toMin, weekday } from '../../utils/format'

const config = useConfig()
const PPM = 1.5 // píxeles por minuto en la línea de tiempo

const view = ref('day')
const day = ref(config.value.today)
const weekAppointments = ref([])
const weekBlocks = ref([])
const services = ref([])
const loading = ref(false)
const showCancelled = ref(false)
const selected = ref(null)
const formOpen = ref(false)
const formPreset = ref(null)
const nowMinutes = ref(nowIn(config.value.timezone).minutes)

let clock
onMounted(async () => {
  clock = setInterval(() => (nowMinutes.value = nowIn(config.value.timezone).minutes), 60_000)
  try {
    services.value = await admin.services()
  } catch (e) {
    toast(e.message, 'error')
  }
})
onBeforeUnmount(() => clearInterval(clock))

// ─── Semana y día ────────────────────────────────────────────────────────────

const weekStart = computed(() => startOfWeek(day.value))
const weekDays = computed(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart.value, i)))
const countFor = (d) => weekAppointments.value.filter((a) => a.date === d && a.status !== 'cancelada').length
const isClosed = (d) => !config.value.schedule[weekday(d)].open || weekBlocks.value.some((b) => b.date === d && !b.start)

let weekRequest = 0
async function loadWeek() {
  const id = ++weekRequest
  loading.value = true
  try {
    const from = weekStart.value
    const to = addDays(from, 6)
    const [appointments, blocks] = await Promise.all([admin.appointments({ from, to }), admin.blocks({ from, to })])
    if (id !== weekRequest) return
    weekAppointments.value = appointments
    weekBlocks.value = blocks
  } catch (e) {
    if (id === weekRequest) toast(e.message, 'error')
  } finally {
    if (id === weekRequest) loading.value = false
  }
}
watch(weekStart, loadWeek, { immediate: true })

function pickDate(e) {
  if (e.target.value) day.value = e.target.value
}

const dayAppointments = computed(() => weekAppointments.value.filter((a) => a.date === day.value))
const active = computed(() => dayAppointments.value.filter((a) => a.status !== 'cancelada'))
const visible = computed(() => (showCancelled.value ? dayAppointments.value : active.value))
const cancelledCount = computed(() => dayAppointments.value.length - active.value.length)
const dayRevenue = computed(() => active.value.filter((a) => a.status !== 'no_asistio').reduce((t, a) => t + a.total, 0))
const dayBlocks = computed(() => weekBlocks.value.filter((b) => b.date === day.value))
const fullBlock = computed(() => dayBlocks.value.find((b) => !b.start))
const schedule = computed(() => {
  const s = config.value.schedule[weekday(day.value)]
  return s.open ? s : null
})

// ─── Línea de tiempo ─────────────────────────────────────────────────────────

const range = computed(() => {
  let start = schedule.value ? toMin(schedule.value.start) : 9 * 60
  let end = schedule.value ? toMin(schedule.value.end) : 20 * 60
  for (const a of visible.value) {
    start = Math.min(start, toMin(a.time))
    end = Math.max(end, toMin(a.time) + a.duration)
  }
  return { start: Math.floor(start / 60) * 60, end: Math.ceil(end / 60) * 60 }
})
const hours = computed(() => {
  const list = []
  for (let m = range.value.start; m < range.value.end; m += 60) list.push(m)
  return list
})
const height = computed(() => (range.value.end - range.value.start) * PPM)
const y = (min) => (min - range.value.start) * PPM
const box = (start, duration) => ({ top: `${y(start)}px`, height: `${Math.max(duration * PPM - 3, 30)}px` })
// Cuánto texto cabe en el bloque: 1 línea, 2 líneas o completo.
const sizeClass = (duration) => (duration * PPM < 58 ? 'compact' : duration * PPM < 76 ? 'medium' : '')

const bands = computed(() => {
  const list = []
  const s = schedule.value
  if (s) {
    if (s.breakStart && s.breakEnd) {
      list.push({ key: 'pause', start: toMin(s.breakStart), end: toMin(s.breakEnd), label: 'Colación' })
    }
    if (toMin(s.start) > range.value.start) list.push({ key: 'pre', start: range.value.start, end: toMin(s.start), closed: true })
    if (toMin(s.end) < range.value.end) list.push({ key: 'post', start: toMin(s.end), end: range.value.end, closed: true })
  }
  for (const b of dayBlocks.value) {
    if (b.start) list.push({ key: b.id, start: toMin(b.start), end: toMin(b.end), label: b.reason || 'Bloqueado' })
  }
  return list
})

// Citas que se topan (por ejemplo, horas manuales) se reparten en columnas.
const laidOut = computed(() => {
  const items = [...visible.value]
    .sort((a, b) => a.time.localeCompare(b.time))
    .map((a) => ({ a, start: toMin(a.time), end: toMin(a.time) + a.duration, col: 0, cols: 1 }))
  let cluster = []
  let clusterEnd = -1
  const flush = () => {
    const cols = Math.max(...cluster.map((i) => i.col)) + 1
    cluster.forEach((i) => (i.cols = cols))
    cluster = []
    clusterEnd = -1
  }
  for (const item of items) {
    if (cluster.length && item.start >= clusterEnd) flush()
    const used = new Set(cluster.filter((c) => c.end > item.start).map((c) => c.col))
    while (used.has(item.col)) item.col++
    cluster.push(item)
    clusterEnd = Math.max(clusterEnd, item.end)
  }
  if (cluster.length) flush()
  return items
})

const nowLine = computed(() => {
  if (day.value !== config.value.today) return null
  const m = nowMinutes.value
  return m >= range.value.start && m <= range.value.end ? y(m) : null
})

function onGridClick(e) {
  const rect = e.currentTarget.getBoundingClientRect()
  const minutes = range.value.start + (e.clientY - rect.top) / PPM
  const step = config.value.slotInterval
  openForm({ date: day.value, time: toHHMM(Math.floor(minutes / step) * step) })
}

// ─── Lista ───────────────────────────────────────────────────────────────────

const filters = reactive({ from: config.value.today, status: '', q: '' })
const listItems = ref([])
const listLoading = ref(false)

let listRequest = 0
async function loadList() {
  const id = ++listRequest
  listLoading.value = true
  try {
    const items = await admin.appointments({ from: filters.from, status: filters.status, q: filters.q })
    if (id === listRequest) listItems.value = items
  } catch (e) {
    if (id === listRequest) toast(e.message, 'error')
  } finally {
    if (id === listRequest) listLoading.value = false
  }
}
let searchTimer
watch(() => [filters.from, filters.status], loadList)
watch(
  () => filters.q,
  () => {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(loadList, 250)
  },
)
watch(view, (v) => {
  if (v === 'list') loadList()
})

const grouped = computed(() => {
  const map = new Map()
  for (const a of listItems.value) {
    if (!map.has(a.date)) map.set(a.date, [])
    map.get(a.date).push(a)
  }
  return [...map]
})

// ─── Acciones ────────────────────────────────────────────────────────────────

function openForm(preset) {
  formPreset.value = preset
  formOpen.value = true
}

function refresh() {
  loadWeek()
  if (view.value === 'list') loadList()
}

function onChanged(updated) {
  selected.value = updated
  refresh()
}

function onCreated(appointment) {
  if (view.value === 'day' && appointment.date !== day.value) day.value = appointment.date
  refresh()
}
</script>

<template>
  <div>
    <header class="page-head">
      <div>
        <p class="eyebrow">Agenda</p>
        <h1 class="page-title">{{ view === 'day' ? longDate(day) : 'Todas las citas' }}</h1>
      </div>
      <div class="head-actions">
        <div class="seg" role="tablist" aria-label="Vista">
          <button type="button" role="tab" :aria-selected="view === 'day'" :class="{ on: view === 'day' }" @click="view = 'day'">
            <Icon name="calendar" :size="16" />Día
          </button>
          <button type="button" role="tab" :aria-selected="view === 'list'" :class="{ on: view === 'list' }" @click="view = 'list'">
            <Icon name="list" :size="16" />Lista
          </button>
        </div>
        <button type="button" class="btn" @click="openForm({ date: view === 'day' ? day : config.today })">
          <Icon name="plus" :size="17" />Nueva cita
        </button>
      </div>
    </header>

    <!-- Vista por día -->
    <template v-if="view === 'day'">
      <div class="week card">
        <button type="button" class="icon-btn" aria-label="Semana anterior" @click="day = addDays(day, -7)">
          <Icon name="chevron-left" />
        </button>
        <div class="days">
          <button
            v-for="d in weekDays"
            :key="d"
            type="button"
            class="wday"
            :class="{ on: d === day, today: d === config.today, closed: isClosed(d) }"
            :aria-pressed="d === day"
            @click="day = d"
          >
            <span class="wd-name">{{ dayName(d) }}</span>
            <span class="wd-num tabular">{{ Number(d.slice(8)) }}</span>
            <span class="wd-count">{{ isClosed(d) && !countFor(d) ? 'Cerrado' : countFor(d) === 1 ? '1 cita' : `${countFor(d)} citas` }}</span>
          </button>
        </div>
        <button type="button" class="icon-btn" aria-label="Semana siguiente" @click="day = addDays(day, 7)">
          <Icon name="chevron-right" />
        </button>
        <div class="week-tools">
          <button type="button" class="btn btn-sm btn-outline" :disabled="day === config.today" @click="day = config.today">Hoy</button>
          <input class="input date-input" type="date" :value="day" aria-label="Ir a fecha" @change="pickDate" />
        </div>
      </div>

      <div class="day-meta">
        <span class="tabular"><strong>{{ active.length }}</strong> {{ active.length === 1 ? 'cita' : 'citas' }} · {{ money(dayRevenue) }} estimados</span>
        <span v-if="schedule" class="muted tabular">Atención {{ schedule.start }}–{{ schedule.end }}</span>
        <label v-if="cancelledCount" class="checkbox small">
          <input v-model="showCancelled" type="checkbox" />
          Mostrar canceladas ({{ cancelledCount }})
        </label>
      </div>

      <div class="timeline card" :class="{ loading }">
        <p v-if="fullBlock || !schedule" class="closed-note">
          <Icon name="ban" :size="16" />
          {{ fullBlock ? fullBlock.reason || 'Día bloqueado' : 'La barbería no atiende este día' }}. Puedes agendar igual con hora manual.
        </p>
        <div class="tl">
          <div class="hours" :style="{ height: `${height}px` }" aria-hidden="true">
            <span v-for="h in hours" :key="h" class="tabular" :style="{ top: `${y(h)}px` }">{{ toHHMM(h) }}</span>
          </div>
          <div class="grid" :style="{ height: `${height}px` }" title="Haz clic en un espacio libre para agendar" @click="onGridClick">
            <span v-for="h in hours" :key="`l${h}`" class="line" :style="{ top: `${y(h)}px` }" />
            <span v-for="h in hours" :key="`h${h}`" class="line half" :style="{ top: `${y(h + 30)}px` }" />
            <div v-for="b in bands" :key="b.key" class="band" :class="{ closed: b.closed }" :style="box(b.start, b.end - b.start)">
              <span v-if="b.label" class="tabular">{{ b.label }} · {{ toHHMM(b.start) }}–{{ toHHMM(b.end) }}</span>
            </div>
            <button
              v-for="it in laidOut"
              :key="it.a.id"
              type="button"
              class="apt"
              :class="[it.a.status, sizeClass(it.a.duration)]"
              :style="{
                ...box(it.start, it.a.duration),
                left: `calc(${it.col} * (100% - 8px) / ${it.cols} + 4px)`,
                width: `calc((100% - 8px) / ${it.cols} - 4px)`,
              }"
              :aria-label="`${it.a.time}, ${it.a.customer.name}, ${it.a.service.name}, ${STATUS_LABEL[it.a.status]}`"
              @click.stop="selected = it.a"
            >
              <span class="apt-time tabular">{{ it.a.time }}–{{ it.a.end }}</span>
              <strong class="apt-name">{{ it.a.customer.name }}</strong>
              <span class="apt-svc">{{ it.a.service.name }}<template v-if="it.a.extras.length"> + {{ it.a.extras.length }}</template></span>
              <Icon v-if="it.a.status === 'completada'" name="check" :size="15" :stroke="2.4" class="apt-icon" />
              <Icon v-else-if="it.a.status === 'no_asistio'" name="ban" :size="15" class="apt-icon" />
            </button>
            <div v-if="nowLine !== null" class="now" :style="{ top: `${nowLine}px` }" aria-hidden="true" />
          </div>
        </div>
      </div>
      <p class="tip muted"><Icon name="plus" :size="14" />Haz clic en cualquier espacio libre de la agenda para crear una cita a esa hora.</p>
    </template>

    <!-- Vista de lista -->
    <template v-else>
      <div class="filters card">
        <label class="search">
          <Icon name="search" :size="17" />
          <span class="sr-only">Buscar</span>
          <input v-model="filters.q" class="input" type="search" placeholder="Buscar por nombre, teléfono o código" />
        </label>
        <label class="field">
          <span class="label">Desde</span>
          <input v-model="filters.from" class="input" type="date" />
        </label>
        <label class="field">
          <span class="label">Estado</span>
          <select v-model="filters.status" class="input">
            <option value="">Todos</option>
            <option v-for="(label, key) in STATUS_LABEL" :key="key" :value="key">{{ label }}</option>
          </select>
        </label>
      </div>

      <div class="card list-card">
        <div v-if="listLoading && !listItems.length" class="list-skeleton">
          <span v-for="n in 5" :key="n" class="skeleton" style="height: 48px" />
        </div>
        <div v-else-if="!listItems.length" class="empty">
          <Icon name="search" :size="26" />
          <strong>No hay citas que coincidan</strong>
          <span>Prueba con otra fecha o estado.</span>
        </div>
        <table v-else class="table">
          <thead>
            <tr>
              <th>Hora</th>
              <th>Cliente</th>
              <th class="hide-sm">Servicio</th>
              <th class="hide-sm">Total</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody v-for="[d, items] in grouped" :key="d">
            <tr class="group-row">
              <td colspan="5">{{ fullDate(d) }} <span class="muted">· {{ items.length }}</span></td>
            </tr>
            <tr
              v-for="a in items"
              :key="a.id"
              class="clickable"
              :class="{ off: a.status === 'cancelada' }"
              tabindex="0"
              @click="selected = a"
              @keydown.enter="selected = a"
            >
              <td class="tabular strong">{{ a.time }}</td>
              <td>
                <strong>{{ a.customer.name }}</strong>
                <span class="sub tabular">{{ a.customer.phone }}</span>
              </td>
              <td class="hide-sm">
                {{ a.service.name }}
                <span v-if="a.extras.length" class="sub">+ {{ a.extras.map((e) => e.name).join(', ') }}</span>
              </td>
              <td class="hide-sm tabular">{{ money(a.total) }}</td>
              <td><StatusBadge :status="a.status" /></td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <AppointmentDetail :appointment="selected" @close="selected = null" @changed="onChanged" />
    <AppointmentForm :open="formOpen" :services="services" :preset="formPreset" @close="formOpen = false" @created="onCreated" />
  </div>
</template>

<style scoped>
.head-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.seg {
  display: inline-flex;
  padding: 4px;
  border: 1px solid var(--line-2);
  border-radius: 999px;
  background: var(--paper);
}
.seg button {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 36px;
  padding: 0 16px;
  border: none;
  border-radius: 999px;
  background: none;
  font-size: 13.5px;
  font-weight: 700;
  cursor: pointer;
}
.seg button.on {
  background: var(--black);
  color: var(--paper);
}

/* Semana */
.week {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px;
}
.days {
  display: grid;
  grid-template-columns: repeat(7, minmax(64px, 1fr));
  flex: 1;
  gap: 4px;
  overflow-x: auto;
  scrollbar-width: none;
}
.wday {
  display: grid;
  justify-items: center;
  gap: 1px;
  padding: 8px 4px;
  border: 1px solid transparent;
  border-radius: 12px;
  background: none;
  cursor: pointer;
  transition: background 0.15s;
}
.wday:hover {
  background: var(--paper-2);
}
.wd-name {
  color: var(--ink-3);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.wd-num {
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 600;
  line-height: 1.2;
}
.wd-count {
  color: var(--ink-3);
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}
.wday.closed .wd-num {
  color: var(--ink-4);
}
.wday.today:not(.on) {
  border-color: var(--line-2);
  border-style: dashed;
}
.wday.on {
  background: var(--black);
  color: var(--paper);
}
.wday.on .wd-name,
.wday.on .wd-count {
  color: #bdbdbd;
}
.wday.on .wd-num {
  color: var(--paper);
}
.week-tools {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-left: 8px;
  border-left: 1px solid var(--line);
}
.date-input {
  width: 150px;
  height: 36px;
}

.day-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 20px;
  margin: 16px 2px 12px;
  font-size: 14px;
}
.checkbox.small {
  margin-left: auto;
  font-size: 13px;
}

/* Línea de tiempo */
.timeline {
  padding: 18px 18px 18px 8px;
  transition: opacity 0.2s;
}
.timeline.loading {
  opacity: 0.55;
}
.closed-note {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 14px 10px;
  padding: 10px 14px;
  border: 1px dashed var(--line-2);
  border-radius: var(--radius-sm);
  color: var(--ink-2);
  font-size: 13.5px;
  font-weight: 600;
}
.tl {
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr);
}
.hours {
  position: relative;
}
.hours span {
  position: absolute;
  right: 12px;
  transform: translateY(-50%);
  color: var(--ink-3);
  font-size: 12px;
  font-weight: 700;
}
.hours span:first-child {
  transform: none;
}
.grid {
  position: relative;
  cursor: copy;
}
.line {
  position: absolute;
  left: 0;
  right: 0;
  border-top: 1px solid var(--line);
  pointer-events: none;
}
.line.half {
  border-top-style: dotted;
  border-color: var(--paper-3);
}
.band {
  position: absolute;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: var(--hatch);
  color: var(--ink-3);
  font-size: 12px;
  font-weight: 700;
  pointer-events: none;
}
.band.closed {
  border-radius: 0;
  background: var(--paper-2);
}
.band span {
  padding: 2px 10px;
  border-radius: 999px;
  background: var(--paper);
}

.apt {
  position: absolute;
  display: grid;
  align-content: start;
  gap: 1px;
  overflow: hidden;
  padding: 7px 12px;
  border: 1.5px solid var(--black);
  border-radius: 10px;
  background: var(--black);
  color: var(--paper);
  text-align: left;
  cursor: pointer;
  transition:
    transform 0.15s var(--ease),
    box-shadow 0.15s;
}
.apt:hover {
  z-index: 2;
  transform: translateY(-1px);
  box-shadow: var(--shadow);
}
.apt-time {
  font-size: 11.5px;
  font-weight: 700;
  opacity: 0.75;
}
.apt-name {
  overflow: hidden;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.apt-svc {
  overflow: hidden;
  font-size: 12.5px;
  opacity: 0.75;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.apt-icon {
  position: absolute;
  top: 8px;
  right: 10px;
}
.apt.compact {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 0;
  padding-bottom: 0;
}
.apt.compact .apt-svc {
  display: none;
}
.apt.compact .apt-icon {
  position: static;
  margin-left: auto;
  flex: none;
}
.apt.medium {
  padding-top: 6px;
  padding-bottom: 6px;
}
.apt.medium .apt-svc {
  display: none;
}
.apt.completada {
  background: var(--paper);
  color: var(--black);
}
.apt.no_asistio {
  border-style: dashed;
  border-color: var(--ink-4);
  background: var(--hatch);
  color: var(--ink-3);
}
.apt.cancelada {
  border-color: var(--line-2);
  background: var(--paper-2);
  color: var(--ink-4);
  text-decoration: line-through;
}
.now {
  position: absolute;
  left: -6px;
  right: 0;
  z-index: 3;
  border-top: 2px solid var(--black);
  pointer-events: none;
}
.now::before {
  content: '';
  position: absolute;
  top: -6px;
  left: 0;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--black);
}
.tip {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  font-size: 12.5px;
}

/* Lista */
.filters {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 180px 180px;
  align-items: end;
  gap: 12px;
  margin-bottom: 14px;
  padding: 14px;
}
.search {
  position: relative;
  display: block;
}
.search svg {
  position: absolute;
  top: 50%;
  left: 14px;
  transform: translateY(-50%);
  color: var(--ink-3);
}
.search .input {
  padding-left: 40px;
}
.list-card {
  overflow: hidden;
}
.list-skeleton {
  display: grid;
  gap: 8px;
  padding: 16px;
}
.group-row td {
  padding-top: 18px;
  background: var(--paper-2);
  font-size: 13px;
  font-weight: 800;
}
.table .strong {
  font-weight: 800;
}
.table .sub {
  display: block;
  color: var(--ink-3);
  font-size: 12.5px;
}
.table tr.off td {
  opacity: 0.55;
}

@media (max-width: 1100px) {
  .week {
    flex-wrap: wrap;
  }
  .days {
    order: -1;
    flex-basis: 100%;
  }
  .week-tools {
    margin-left: auto;
    border: none;
  }
}
@media (max-width: 720px) {
  .filters {
    grid-template-columns: 1fr 1fr;
  }
  .search {
    grid-column: 1 / -1;
  }
  .hide-sm {
    display: none;
  }
  .checkbox.small {
    margin-left: 0;
  }
}
</style>
