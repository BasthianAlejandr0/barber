<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { admin } from '../api'
import { confirmDialog } from '../confirm'
import { useConfig } from '../stores/config'
import { toast } from '../toast'
import { STATUS_LABEL, firstName, formatDuration, fullDate, longDate, money, whatsappLink } from '../utils/format'
import AppModal from './AppModal.vue'
import Icon from './Icon.vue'
import SlotGrid from './SlotGrid.vue'
import StatusBadge from './StatusBadge.vue'

const props = defineProps({ appointment: { type: Object, default: null } })
const emit = defineEmits(['close', 'changed'])
const config = useConfig()

const a = computed(() => props.appointment)
const mode = ref('view') // view | reschedule | edit
const busy = ref(false)

const newDate = ref('')
const newTime = ref('')
const slots = ref([])
const slotsLoading = ref(false)
const slotsMessage = ref('')
const draft = reactive({ name: '', phone: '', email: '', notes: '' })

watch(
  () => props.appointment?.id,
  () => (mode.value = 'view'),
)

const initials = computed(() =>
  (a.value?.customer.name || '')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase(),
)
const reminderUrl = computed(() =>
  whatsappLink(
    a.value.customer.phone,
    `Hola ${firstName(a.value.customer.name)}, te recordamos tu hora en ${config.value.business.name} el ${longDate(a.value.date).toLowerCase()} a las ${a.value.time}. ¡Te esperamos!`,
  ),
)
const createdAt = computed(() =>
  new Date(a.value.createdAt).toLocaleString('es-CL', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: config.value.timezone,
  }),
)

async function patch(body, message) {
  busy.value = true
  try {
    const updated = await admin.updateAppointment(a.value.id, body)
    emit('changed', updated)
    toast(message)
    return true
  } catch (e) {
    toast(e.message, 'error', 5000)
    return false
  } finally {
    busy.value = false
  }
}

const setStatus = (status) => patch({ status }, `Cita marcada como «${STATUS_LABEL[status].toLowerCase()}».`)

async function cancelAppointment() {
  const ok = await confirmDialog({
    title: '¿Cancelar esta cita?',
    message: `La hora de ${a.value.customer.name} quedará libre para que otra persona la reserve.`,
    confirmText: 'Cancelar cita',
  })
  if (ok) setStatus('cancelada')
}

async function remove() {
  const ok = await confirmDialog({
    title: '¿Eliminar esta cita?',
    message: 'Se borrará del historial de forma permanente. Si solo quieres liberar la hora, es mejor cancelarla.',
    confirmText: 'Eliminar',
  })
  if (!ok) return
  busy.value = true
  try {
    await admin.deleteAppointment(a.value.id)
    toast('Cita eliminada.')
    emit('changed', null)
    emit('close')
  } catch (e) {
    toast(e.message, 'error')
  } finally {
    busy.value = false
  }
}

// ─── Reagendar ──────────────────────────────────────────────────────────────

let slotRequest = 0
async function loadSlots() {
  const id = ++slotRequest
  slotsLoading.value = true
  try {
    const r = await admin.slots(newDate.value, a.value.duration, a.value.id)
    if (id !== slotRequest) return
    slots.value = r.slots
    slotsMessage.value = r.closed ? r.reason : r.slots.length ? '' : 'No hay horas libres este día.'
  } catch (e) {
    if (id === slotRequest) slotsMessage.value = e.message
  } finally {
    if (id === slotRequest) slotsLoading.value = false
  }
}

function startReschedule() {
  newDate.value = a.value.date
  newTime.value = ''
  mode.value = 'reschedule'
  loadSlots()
}
watch(newDate, (d) => {
  if (mode.value !== 'reschedule' || !d) return
  newTime.value = ''
  loadSlots()
})

async function saveReschedule() {
  const body = { date: newDate.value, time: newTime.value }
  if (a.value.status === 'cancelada') body.status = 'confirmada'
  if (await patch(body, `Cita movida al ${longDate(newDate.value).toLowerCase()} a las ${newTime.value}.`)) mode.value = 'view'
}

// ─── Editar datos ───────────────────────────────────────────────────────────

function startEdit() {
  Object.assign(draft, { ...a.value.customer, notes: a.value.notes })
  mode.value = 'edit'
}
async function saveEdit() {
  const { notes, ...customer } = draft
  if (await patch({ customer, notes }, 'Datos actualizados.')) mode.value = 'view'
}

const title = computed(() => ({ view: 'Detalle de la cita', reschedule: 'Reagendar cita', edit: 'Editar datos' })[mode.value])
</script>

<template>
  <AppModal :open="!!appointment" :title="title" width="660px" @close="emit('close')">
    <template v-if="a">
      <div class="top">
        <div>
          <p class="date">{{ fullDate(a.date) }}</p>
          <p class="time tabular">{{ a.time }} – {{ a.end }}</p>
        </div>
        <StatusBadge :status="a.status" />
      </div>

      <template v-if="mode === 'view'">
        <section class="client">
          <span class="avatar" aria-hidden="true">{{ initials }}</span>
          <div class="who">
            <strong>{{ a.customer.name }}</strong>
            <span class="tabular">{{ a.customer.phone }}</span>
            <span v-if="a.customer.email">{{ a.customer.email }}</span>
          </div>
          <div class="contact">
            <a :href="`tel:${a.customer.phone.replace(/[^\d+]/g, '')}`" class="icon-btn bordered" aria-label="Llamar" title="Llamar">
              <Icon name="phone" :size="17" />
            </a>
            <a :href="reminderUrl" target="_blank" rel="noopener" class="icon-btn bordered" aria-label="Enviar recordatorio por WhatsApp" title="Recordatorio por WhatsApp">
              <Icon name="message" :size="17" />
            </a>
          </div>
        </section>

        <section class="items">
          <div class="row">
            <span>{{ a.service.name }}</span><span class="tabular">{{ money(a.service.price) }}</span>
          </div>
          <div v-for="e in a.extras" :key="e.id" class="row extra">
            <span>+ {{ e.name }}</span><span class="tabular">{{ money(e.price) }}</span>
          </div>
          <div class="row total">
            <span>Total · {{ formatDuration(a.duration) }}</span><strong class="tabular">{{ money(a.total) }}</strong>
          </div>
        </section>

        <p v-if="a.notes" class="notes">“{{ a.notes }}”</p>
        <p class="meta">
          {{ a.source === 'web' ? 'Reservada online' : 'Agendada desde el panel' }} · {{ createdAt }} · Código
          <span class="tabular">{{ a.code }}</span>
        </p>
      </template>

      <div v-else-if="mode === 'reschedule'" class="resched">
        <label class="field">
          <span class="label">Nueva fecha</span>
          <input v-model="newDate" class="input" type="date" :min="config.today" />
        </label>
        <SlotGrid v-model="newTime" :slots="slots" :loading="slotsLoading" :message="slotsMessage" />
      </div>

      <form v-else class="edit" @submit.prevent="saveEdit">
        <label class="field">
          <span class="label">Nombre</span>
          <input v-model="draft.name" class="input" maxlength="80" />
        </label>
        <label class="field">
          <span class="label">Teléfono</span>
          <input v-model="draft.phone" class="input" type="tel" maxlength="24" />
        </label>
        <label class="field full">
          <span class="label">Correo <small>(opcional)</small></span>
          <input v-model="draft.email" class="input" type="email" maxlength="120" />
        </label>
        <label class="field full">
          <span class="label">Comentarios</span>
          <textarea v-model="draft.notes" class="input" maxlength="300" />
        </label>
      </form>
    </template>

    <template #footer>
      <template v-if="a && mode === 'view'">
        <div class="secondary">
          <button type="button" class="icon-btn bordered" :disabled="busy" title="Eliminar" aria-label="Eliminar cita" @click="remove">
            <Icon name="trash" :size="17" />
          </button>
          <button type="button" class="icon-btn bordered" :disabled="busy" title="Editar datos" aria-label="Editar datos" @click="startEdit">
            <Icon name="edit" :size="17" />
          </button>
          <button type="button" class="btn btn-sm btn-ghost" :disabled="busy" @click="startReschedule">
            <Icon name="refresh" :size="15" />Reagendar
          </button>
        </div>
        <template v-if="a.status === 'confirmada'">
          <button type="button" class="btn btn-sm btn-outline" :disabled="busy" @click="setStatus('no_asistio')">No asistió</button>
          <button type="button" class="btn btn-sm btn-outline" :disabled="busy" @click="cancelAppointment">Cancelar</button>
          <button type="button" class="btn btn-sm" :disabled="busy" @click="setStatus('completada')">
            <Icon name="check" :size="15" />Completada
          </button>
        </template>
        <button v-else-if="a.status === 'cancelada'" type="button" class="btn btn-sm" :disabled="busy" @click="setStatus('confirmada')">
          Reactivar cita
        </button>
        <button v-else type="button" class="btn btn-sm btn-outline" :disabled="busy" @click="setStatus('confirmada')">
          Volver a «confirmada»
        </button>
      </template>
      <template v-else-if="a">
        <button type="button" class="btn btn-sm btn-outline" @click="mode = 'view'">Volver</button>
        <button v-if="mode === 'reschedule'" type="button" class="btn btn-sm" :disabled="busy || !newTime" @click="saveReschedule">
          Guardar nueva hora
        </button>
        <button v-else type="button" class="btn btn-sm" :disabled="busy" @click="saveEdit">Guardar</button>
      </template>
    </template>
  </AppModal>
</template>

<style scoped>
.top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}
.date {
  color: var(--ink-3);
  font-size: 13.5px;
  font-weight: 600;
}
.time {
  font-family: var(--font-display);
  font-size: 34px;
  font-weight: 500;
  line-height: 1.1;
}
.client {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
}
.avatar {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  flex: none;
  border-radius: 50%;
  background: var(--black);
  color: var(--paper);
  font-size: 14px;
  font-weight: 800;
}
.who {
  display: grid;
  flex: 1;
  min-width: 0;
  font-size: 13.5px;
  color: var(--ink-3);
}
.who strong {
  color: var(--ink);
  font-size: 15px;
}
.contact {
  display: flex;
  gap: 6px;
}
.items {
  display: grid;
  gap: 7px;
  margin-top: 16px;
  font-size: 14px;
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
  margin-top: 6px;
  padding-top: 10px;
  border-top: 1px solid var(--line);
  font-weight: 700;
}
.notes {
  margin-top: 16px;
  padding: 12px 14px;
  border-left: 3px solid var(--black);
  background: var(--paper-2);
  font-size: 14px;
  font-style: italic;
}
.meta {
  margin-top: 16px;
  color: var(--ink-4);
  font-size: 12px;
}
.resched {
  display: grid;
  gap: 18px;
}
.edit {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.edit .full {
  grid-column: 1 / -1;
}
.secondary {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-right: auto;
}
@media (max-width: 640px) {
  .secondary {
    flex: 1 1 100%;
  }
  .secondary :deep(.btn) {
    flex: 0 0 auto !important;
  }
  .edit {
    grid-template-columns: 1fr;
  }
}
</style>
