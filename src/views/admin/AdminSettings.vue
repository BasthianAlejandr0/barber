<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { DEMO, admin } from '../../api'
import Icon from '../../components/Icon.vue'
import { confirmDialog } from '../../confirm'
import { loadConfig, useConfig } from '../../stores/config'
import { toast } from '../../toast'
import { formatDuration, fullDate } from '../../utils/format'

const config = useConfig()

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]
const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const INTERVALS = [10, 15, 20, 30, 45, 60]
const NOTICES = [0, 30, 60, 120, 180, 240, 720, 1440]
const WINDOWS = [7, 14, 21, 30, 45, 60, 90]

const original = ref('')
const draft = ref(null)
const saving = ref(false)
const blocks = ref([])
const newBlock = reactive({ date: config.value.today, allDay: true, start: '10:00', end: '13:00', reason: '' })
const addingBlock = ref(false)

const dirty = computed(() => draft.value && JSON.stringify(draft.value) !== original.value)

function setDraft(settings) {
  original.value = JSON.stringify(settings)
  draft.value = JSON.parse(original.value)
}

onMounted(async () => {
  try {
    const [settings, list] = await Promise.all([admin.settings(), admin.blocks()])
    setDraft(settings)
    blocks.value = list
  } catch (e) {
    toast(e.message, 'error')
  }
})

async function save() {
  saving.value = true
  try {
    setDraft(await admin.saveSettings(draft.value))
    await loadConfig(true)
    toast('Ajustes guardados.')
  } catch (e) {
    toast(e.message, 'error', 5000)
  } finally {
    saving.value = false
  }
}

const discard = () => (draft.value = JSON.parse(original.value))

function togglePause(day) {
  if (day.breakStart) Object.assign(day, { breakStart: '', breakEnd: '' })
  else Object.assign(day, { breakStart: '14:00', breakEnd: '15:00' })
}

function copyMonday() {
  const monday = draft.value.schedule[1]
  for (const i of [2, 3, 4, 5]) draft.value.schedule[i] = { ...monday }
  toast('Horario del lunes copiado de martes a viernes.')
}

const noticeLabel = (m) => (m === 0 ? 'Sin anticipación' : m < 60 ? `${m} minutos antes` : `${formatDuration(m)} antes`)

// ─── Bloqueos ───────────────────────────────────────────────────────────────

async function addBlock() {
  addingBlock.value = true
  try {
    const block = await admin.createBlock({ ...newBlock })
    blocks.value = await admin.blocks()
    newBlock.reason = ''
    if (block.conflicts) {
      toast(`Bloqueo creado. Ojo: hay ${block.conflicts} ${block.conflicts === 1 ? 'cita' : 'citas'} en ese horario; revísalas en la agenda.`, 'error', 7000)
    } else {
      toast('Bloqueo creado.')
    }
  } catch (e) {
    toast(e.message, 'error')
  } finally {
    addingBlock.value = false
  }
}

async function removeBlock(block) {
  const ok = await confirmDialog({
    title: '¿Quitar este bloqueo?',
    message: 'Esas horas volverán a estar disponibles para reservar.',
    confirmText: 'Quitar bloqueo',
  })
  if (!ok) return
  try {
    await admin.deleteBlock(block.id)
    blocks.value = blocks.value.filter((b) => b.id !== block.id)
    toast('Bloqueo eliminado.')
  } catch (e) {
    toast(e.message, 'error')
  }
}
</script>

<template>
  <div class="settings">
    <header class="page-head">
      <div>
        <p class="eyebrow">Configuración</p>
        <h1 class="page-title">Ajustes</h1>
        <p class="page-sub">Datos del negocio, horario de atención y reglas para reservar.</p>
      </div>
    </header>

    <div v-if="!draft" class="skeleton" style="height: 420px; border-radius: 16px" />

    <template v-else>
      <section class="card section">
        <header class="sec-head">
          <h2 class="section-title">Negocio</h2>
          <p class="muted small">Se muestra en la página de reservas y en el comprobante del cliente.</p>
        </header>
        <div class="fields">
          <label class="field">
            <span class="label">Nombre</span>
            <input v-model="draft.business.name" class="input" maxlength="60" />
          </label>
          <label class="field">
            <span class="label">Teléfono <small>(opcional)</small></span>
            <input v-model="draft.business.phone" class="input" type="tel" maxlength="30" placeholder="+56 9 1234 5678" />
          </label>
          <label class="field full">
            <span class="label">Frase de presentación</span>
            <input v-model="draft.business.tagline" class="input" maxlength="140" />
          </label>
          <label class="field">
            <span class="label">Dirección <small>(opcional)</small></span>
            <input v-model="draft.business.address" class="input" maxlength="160" placeholder="Calle 123, Comuna" />
          </label>
          <label class="field">
            <span class="label">Instagram <small>(opcional)</small></span>
            <input v-model="draft.business.instagram" class="input" maxlength="60" placeholder="usuario, sin @" />
          </label>
        </div>
      </section>

      <section class="card section">
        <header class="sec-head row">
          <div>
            <h2 class="section-title">Horario de atención</h2>
            <p class="muted small">Los clientes solo ven horas dentro de este horario y fuera de la pausa.</p>
          </div>
          <button type="button" class="btn btn-sm btn-outline" @click="copyMonday"><Icon name="copy" :size="15" />Copiar lunes a mar–vie</button>
        </header>
        <ul class="days">
          <li v-for="i in DAY_ORDER" :key="i" :class="{ off: !draft.schedule[i].open }">
            <label class="day-toggle">
              <span class="switch">
                <input v-model="draft.schedule[i].open" type="checkbox" :aria-label="`Abrir el ${DAY_NAMES[i]}`" />
                <span />
              </span>
              <strong>{{ DAY_NAMES[i] }}</strong>
            </label>
            <template v-if="draft.schedule[i].open">
              <div class="range">
                <input v-model="draft.schedule[i].start" class="input time" type="time" step="900" :aria-label="`Apertura ${DAY_NAMES[i]}`" />
                <span class="muted">a</span>
                <input v-model="draft.schedule[i].end" class="input time" type="time" step="900" :aria-label="`Cierre ${DAY_NAMES[i]}`" />
              </div>
              <div class="pause">
                <template v-if="draft.schedule[i].breakStart">
                  <span class="muted small">Pausa</span>
                  <input v-model="draft.schedule[i].breakStart" class="input time" type="time" step="900" :aria-label="`Inicio pausa ${DAY_NAMES[i]}`" />
                  <span class="muted">a</span>
                  <input v-model="draft.schedule[i].breakEnd" class="input time" type="time" step="900" :aria-label="`Fin pausa ${DAY_NAMES[i]}`" />
                  <button type="button" class="icon-btn" aria-label="Quitar pausa" title="Quitar pausa" @click="togglePause(draft.schedule[i])">
                    <Icon name="x" :size="16" />
                  </button>
                </template>
                <button v-else type="button" class="btn btn-sm btn-ghost" @click="togglePause(draft.schedule[i])">
                  <Icon name="plus" :size="14" />Agregar pausa
                </button>
              </div>
            </template>
            <span v-else class="closed muted">Cerrado</span>
          </li>
        </ul>
      </section>

      <section class="card section">
        <header class="sec-head">
          <h2 class="section-title">Reglas de reserva</h2>
          <p class="muted small">Cómo y con cuánta anticipación pueden reservar tus clientes.</p>
        </header>
        <div class="fields three">
          <label class="field">
            <span class="label">Horas cada</span>
            <select v-model.number="draft.slotInterval" class="input">
              <option v-for="m in INTERVALS" :key="m" :value="m">{{ m }} minutos</option>
            </select>
            <span class="hint">Separación entre las horas que se ofrecen.</span>
          </label>
          <label class="field">
            <span class="label">Anticipación mínima</span>
            <select v-model.number="draft.minNoticeMinutes" class="input">
              <option v-for="m in NOTICES" :key="m" :value="m">{{ noticeLabel(m) }}</option>
            </select>
            <span class="hint">Evita reservas de último minuto.</span>
          </label>
          <label class="field">
            <span class="label">Reservas hasta</span>
            <select v-model.number="draft.bookingWindowDays" class="input">
              <option v-for="d in WINDOWS" :key="d" :value="d">{{ d }} días adelante</option>
            </select>
            <span class="hint">Qué tan lejos en el futuro se puede agendar.</span>
          </label>
        </div>
      </section>

      <section class="card section">
        <header class="sec-head">
          <h2 class="section-title">Días libres y bloqueos</h2>
          <p class="muted small">Vacaciones, feriados o un trámite: esas horas dejan de ofrecerse.</p>
        </header>
        <form class="block-form" @submit.prevent="addBlock">
          <label class="field">
            <span class="label">Fecha</span>
            <input v-model="newBlock.date" class="input" type="date" :min="config.today" required />
          </label>
          <label class="checkbox all-day">
            <input v-model="newBlock.allDay" type="checkbox" />
            Todo el día
          </label>
          <div v-if="!newBlock.allDay" class="field">
            <span class="label">Horas</span>
            <div class="range">
              <input v-model="newBlock.start" class="input time" type="time" step="900" aria-label="Desde" />
              <span class="muted">a</span>
              <input v-model="newBlock.end" class="input time" type="time" step="900" aria-label="Hasta" />
            </div>
          </div>
          <label class="field reason">
            <span class="label">Motivo <small>(lo ve el cliente)</small></span>
            <input v-model="newBlock.reason" class="input" maxlength="80" placeholder="Ej: Feriado" />
          </label>
          <button type="submit" class="btn" :disabled="addingBlock || !newBlock.date"><Icon name="plus" :size="16" />Bloquear</button>
        </form>
        <ul v-if="blocks.length" class="blocks">
          <li v-for="b in blocks" :key="b.id">
            <Icon name="ban" :size="17" />
            <div>
              <strong>{{ fullDate(b.date) }}</strong>
              <span class="muted small tabular">{{ b.start ? `${b.start} a ${b.end}` : 'Todo el día' }}<template v-if="b.reason"> · {{ b.reason }}</template></span>
            </div>
            <button type="button" class="icon-btn" aria-label="Quitar bloqueo" title="Quitar bloqueo" @click="removeBlock(b)">
              <Icon name="trash" :size="16" />
            </button>
          </li>
        </ul>
        <p v-else class="muted small no-blocks">No hay bloqueos próximos.</p>
      </section>

      <section class="card section access">
        <Icon name="lock" :size="20" />
        <div>
          <h2 class="section-title">Acceso al panel</h2>
          <p v-if="DEMO" class="muted small">
            En esta demo la contraseña es <code>amilcar2026</code>. En la versión con servidor se define en el archivo
            <code>.env</code> con la variable <code>ADMIN_PASSWORD</code>.
          </p>
          <p v-else class="muted small">
            La contraseña se define en el archivo <code>.env</code> del servidor con la variable <code>ADMIN_PASSWORD</code>. Después de
            cambiarla, reinicia el servidor.
          </p>
        </div>
      </section>

      <Transition name="bar">
        <div v-if="dirty" class="save-bar">
          <span>Tienes cambios sin guardar</span>
          <div>
            <button type="button" class="btn btn-sm btn-ghost inv" @click="discard">Descartar</button>
            <button type="button" class="btn btn-sm btn-light" :disabled="saving" @click="save">
              <span v-if="saving" class="spinner" />Guardar cambios
            </button>
          </div>
        </div>
      </Transition>
    </template>
  </div>
</template>

<style scoped>
.settings {
  max-width: 920px;
  padding-bottom: 60px;
}
.section {
  margin-bottom: 18px;
  padding: 22px;
}
.sec-head {
  margin-bottom: 18px;
}
.sec-head.row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.small {
  font-size: 13px;
}
.fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.fields.three {
  grid-template-columns: repeat(3, 1fr);
}
.fields .full {
  grid-column: 1 / -1;
}

.days {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}
.days li {
  display: grid;
  grid-template-columns: 170px auto 1fr;
  align-items: center;
  gap: 16px;
  min-height: 62px;
  padding: 8px 0;
  border-top: 1px solid var(--line);
}
.day-toggle {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
}
.days li.off strong {
  color: var(--ink-3);
}
.range,
.pause {
  display: flex;
  align-items: center;
  gap: 8px;
}
.input.time {
  width: 116px;
  height: 40px;
  padding: 0 10px;
}
.closed {
  font-size: 13.5px;
}

.block-form {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 14px;
  padding: 16px;
  border-radius: var(--radius-sm);
  background: var(--paper-2);
}
.block-form .field:first-child {
  width: 170px;
}
.all-day {
  height: 46px;
}
.reason {
  flex: 1;
  min-width: 180px;
}
.blocks {
  display: grid;
  margin: 14px 0 0;
  padding: 0;
  list-style: none;
}
.blocks li {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 4px;
  border-bottom: 1px solid var(--line);
}
.blocks li div {
  display: grid;
  flex: 1;
}
.no-blocks {
  margin-top: 14px;
}
.access {
  display: flex;
  gap: 14px;
}
code {
  padding: 1px 6px;
  border-radius: 6px;
  background: var(--paper-3);
  font-size: 12.5px;
}

.save-bar {
  position: sticky;
  bottom: 18px;
  z-index: 10;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px 12px 22px;
  border-radius: 999px;
  background: var(--black);
  color: var(--paper);
  box-shadow: 0 18px 40px -12px rgb(0 0 0 / 0.45);
  font-size: 14px;
  font-weight: 700;
}
.save-bar div {
  display: flex;
  gap: 8px;
}
.btn-ghost.inv {
  color: var(--paper);
}
.btn-ghost.inv:hover {
  background: #222;
}
.bar-enter-active,
.bar-leave-active {
  transition: all 0.25s var(--ease);
}
.bar-enter-from,
.bar-leave-to {
  opacity: 0;
  transform: translateY(14px);
}

@media (max-width: 760px) {
  .fields,
  .fields.three {
    grid-template-columns: 1fr;
  }
  .days li {
    grid-template-columns: 1fr;
    gap: 10px;
    padding: 14px 0;
  }
  .pause {
    flex-wrap: wrap;
  }
  .input.time {
    width: 104px;
  }
  .save-bar {
    border-radius: var(--radius);
  }
}
</style>
