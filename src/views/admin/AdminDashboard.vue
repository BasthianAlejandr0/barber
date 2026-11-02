<script setup>
import { computed, onMounted, ref } from 'vue'
import { admin } from '../../api'
import AppointmentDetail from '../../components/AppointmentDetail.vue'
import Icon from '../../components/Icon.vue'
import ShareCard from '../../components/ShareCard.vue'
import StatusBadge from '../../components/StatusBadge.vue'
import { useConfig } from '../../stores/config'
import { toast } from '../../toast'
import { addDays, firstName, formatDuration, fullDate, longDate, money, nowIn, toMin, whatsappLink } from '../../utils/format'

const config = useConfig()
const stats = ref(null)
const todayList = ref([])
const loading = ref(true)
const selected = ref(null)

async function load() {
  try {
    const s = await admin.stats()
    stats.value = s
    todayList.value = await admin.appointments({ from: s.today, to: s.today })
  } catch (e) {
    toast(e.message, 'error')
  } finally {
    loading.value = false
  }
}
onMounted(load)

const greeting = computed(() => {
  const h = nowIn(config.value.timezone).minutes / 60
  return h < 12 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches'
})
const owner = computed(() => firstName(config.value.business.name))

const tiles = computed(() => {
  const s = stats.value
  if (!s) return []
  return [
    { label: 'Citas de hoy', value: s.todayCount, note: `${s.todayPending} por atender` },
    { label: 'Ingresos estimados hoy', value: money(s.todayRevenue), note: 'Citas no canceladas' },
    { label: 'Esta semana', value: s.weekCount, note: `${money(s.weekRevenue)} estimados` },
    { label: 'Cobrado este mes', value: money(s.monthRevenue), note: `${s.monthCompleted} citas completadas` },
  ]
})

const next = computed(() => stats.value?.next)
const nextWhen = computed(() => {
  const n = next.value
  if (!n) return ''
  if (n.date === stats.value.today) {
    const diff = toMin(n.time) - nowIn(config.value.timezone).minutes
    if (diff <= 0) return 'En curso'
    return diff < 60 ? `Hoy, en ${diff} min` : `Hoy, en ${formatDuration(diff)}`
  }
  if (n.date === addDays(stats.value.today, 1)) return 'Mañana'
  return longDate(n.date)
})
const nextReminder = computed(
  () =>
    next.value &&
    whatsappLink(
      next.value.customer.phone,
      `Hola ${firstName(next.value.customer.name)}, te recordamos tu hora en ${config.value.business.name} el ${longDate(next.value.date).toLowerCase()} a las ${next.value.time}. ¡Te esperamos!`,
    ),
)

const topMax = computed(() => Math.max(1, ...(stats.value?.topServices.map((t) => t.count) ?? [])))

async function quick(appointment, status, message) {
  try {
    await admin.updateAppointment(appointment.id, { status })
    toast(message)
    load()
  } catch (e) {
    toast(e.message, 'error')
  }
}

function onChanged(updated) {
  selected.value = updated
  load()
}
</script>

<template>
  <div>
    <header class="page-head">
      <div>
        <p class="eyebrow">{{ stats ? fullDate(stats.today) : '' }}</p>
        <h1 class="page-title">{{ greeting }}, {{ owner }}</h1>
      </div>
      <RouterLink :to="{ name: 'admin-agenda' }" class="btn"><Icon name="calendar" :size="17" />Abrir agenda</RouterLink>
    </header>

    <div v-if="loading" class="tiles">
      <span v-for="n in 4" :key="n" class="skeleton" style="height: 112px; border-radius: 16px" />
    </div>

    <template v-else-if="stats">
      <section class="tiles" aria-label="Indicadores">
        <div v-for="t in tiles" :key="t.label" class="tile card">
          <p class="tile-label">{{ t.label }}</p>
          <p class="tile-value tabular">{{ t.value }}</p>
          <p class="tile-note">{{ t.note }}</p>
        </div>
      </section>

      <div class="grid">
        <section class="card today">
          <header class="card-head">
            <h2 class="section-title">Agenda de hoy</h2>
            <RouterLink :to="{ name: 'admin-agenda' }" class="more">Ver todo <Icon name="arrow-right" :size="14" /></RouterLink>
          </header>
          <ul v-if="todayList.length" class="list">
            <li v-for="a in todayList" :key="a.id" :class="{ off: a.status === 'cancelada' }">
              <button type="button" class="row" @click="selected = a">
                <span class="r-time tabular">{{ a.time }}</span>
                <span class="r-who">
                  <strong>{{ a.customer.name }}</strong>
                  <span>{{ a.service.name }}<template v-if="a.extras.length"> + {{ a.extras.length }}</template></span>
                </span>
                <span class="r-total tabular">{{ money(a.total) }}</span>
                <StatusBadge :status="a.status" />
              </button>
              <div v-if="a.status === 'confirmada'" class="r-quick">
                <button type="button" class="icon-btn bordered" title="Marcar completada" aria-label="Marcar completada" @click="quick(a, 'completada', 'Cita completada.')">
                  <Icon name="check" :size="16" />
                </button>
                <button type="button" class="icon-btn bordered" title="No asistió" aria-label="Marcar que no asistió" @click="quick(a, 'no_asistio', 'Marcada como no asistida.')">
                  <Icon name="ban" :size="16" />
                </button>
              </div>
            </li>
          </ul>
          <div v-else class="empty">
            <Icon name="calendar" :size="26" />
            <strong>No hay citas para hoy</strong>
            <span>Comparte tu enlace de reservas para llenar la agenda.</span>
          </div>
        </section>

        <div class="side">
          <section class="next">
            <p class="eyebrow">Próxima cita</p>
            <template v-if="next">
              <p class="next-when">{{ nextWhen }}</p>
              <p class="next-time tabular">{{ next.time }}</p>
              <p class="next-who">{{ next.customer.name }}</p>
              <p class="next-svc">
                {{ next.service.name }}<template v-for="e in next.extras" :key="e.id"> + {{ e.name }}</template>
              </p>
              <div class="next-actions">
                <button type="button" class="btn btn-sm btn-light" @click="selected = next">Ver detalle</button>
                <a :href="nextReminder" target="_blank" rel="noopener" class="btn btn-sm btn-outline inv"><Icon name="message" :size="15" />Recordar</a>
              </div>
            </template>
            <p v-else class="next-empty">No hay citas pendientes.</p>
          </section>

          <section class="card top">
            <header class="card-head">
              <h2 class="section-title">Más pedidos</h2>
              <span class="muted small">Últimos 30 días</span>
            </header>
            <ul v-if="stats.topServices.length" class="bars">
              <li v-for="t in stats.topServices" :key="t.name" :title="`${t.name}: ${t.count} citas`">
                <span class="bar-label">{{ t.name }}</span>
                <span class="bar-track">
                  <span class="bar" :style="{ width: `calc((100% - 36px) * ${t.count / topMax})` }" />
                  <span class="bar-value tabular">{{ t.count }}</span>
                </span>
              </li>
            </ul>
            <p v-else class="muted small top-empty">Aún no hay citas atendidas en este período.</p>
          </section>
        </div>
      </div>

      <ShareCard :business-name="config.business.name" />
    </template>

    <AppointmentDetail :appointment="selected" @close="selected = null" @changed="onChanged" />
  </div>
</template>

<style scoped>
.tiles {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 18px;
}
.tile {
  padding: 18px 20px;
}
.tile-label {
  color: var(--ink-3);
  font-size: 13px;
  font-weight: 600;
}
.tile-value {
  margin: 6px 0 2px;
  font-size: 30px;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.1;
}
.tile-note {
  color: var(--ink-4);
  font-size: 12.5px;
}

.grid {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr);
  gap: 18px;
  margin-bottom: 18px;
  align-items: start;
}
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 20px 12px;
}
.more {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
}
.small {
  font-size: 12.5px;
}

.list {
  margin: 0;
  padding: 0 8px 8px;
  list-style: none;
}
.list li {
  display: flex;
  align-items: center;
  gap: 8px;
  border-top: 1px solid var(--line);
}
.list li.off {
  opacity: 0.5;
}
.row {
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 14px;
  flex: 1;
  min-width: 0;
  padding: 12px;
  border: none;
  border-radius: var(--radius-sm);
  background: none;
  text-align: left;
  cursor: pointer;
}
.row:hover {
  background: var(--paper-2);
}
.r-time {
  font-size: 16px;
  font-weight: 800;
}
.r-who {
  display: grid;
  min-width: 0;
}
.r-who strong,
.r-who span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.r-who span {
  color: var(--ink-3);
  font-size: 13px;
}
.r-total {
  font-weight: 700;
  font-size: 14px;
}
.r-quick {
  display: flex;
  gap: 6px;
  padding-right: 8px;
}

.side {
  display: grid;
  gap: 18px;
}
.next {
  position: relative;
  overflow: hidden;
  padding: 22px;
  border-radius: var(--radius);
  background: var(--black);
  color: var(--paper);
}
.next::after {
  content: '';
  position: absolute;
  top: 0;
  right: 22px;
  bottom: 0;
  width: 12px;
  background: repeating-linear-gradient(-45deg, var(--paper) 0 6px, var(--black) 6px 12px);
  opacity: 0.25;
}
.next .eyebrow {
  color: var(--ink-4);
}
.next-when {
  margin-top: 14px;
  color: #cfcfcf;
  font-size: 13.5px;
  font-weight: 600;
}
.next-time {
  font-family: var(--font-display);
  font-size: 54px;
  font-weight: 500;
  line-height: 1;
}
.next-who {
  margin-top: 10px;
  font-size: 17px;
  font-weight: 800;
}
.next-svc {
  color: #b5b5b5;
  font-size: 13.5px;
  padding-right: 30px;
}
.next-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 18px;
}
.btn-outline.inv {
  border-color: #5a5a5a;
  color: var(--paper);
}
.btn-outline.inv:hover {
  background: #222;
}
.next-empty {
  margin-top: 10px;
  color: #b5b5b5;
}

.top {
  padding-bottom: 18px;
}
.top-empty {
  padding: 0 20px;
}
.bars {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 2px 20px 0;
  list-style: none;
}
.bars li {
  display: grid;
  gap: 5px;
}
.bar-label {
  font-size: 13px;
  font-weight: 600;
}
.bar-track {
  display: flex;
  align-items: center;
  gap: 8px;
}
.bar {
  height: 10px;
  min-width: 4px;
  border-radius: 0 4px 4px 0;
  background: var(--black);
}
.bar-value {
  color: var(--ink-2);
  font-size: 12.5px;
  font-weight: 700;
}

@media (max-width: 1100px) {
  .tiles {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .grid {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 560px) {
  .tile-value {
    font-size: 24px;
  }
  .row {
    grid-template-columns: 48px minmax(0, 1fr) auto;
  }
  .row .r-total {
    display: none;
  }
  .r-quick {
    display: none;
  }
}
</style>
