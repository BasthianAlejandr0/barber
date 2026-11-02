<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { admin } from '../api'
import { useConfig } from '../stores/config'
import { toast } from '../toast'
import { formatDuration, money } from '../utils/format'
import AppModal from './AppModal.vue'
import Icon from './Icon.vue'
import SlotGrid from './SlotGrid.vue'

const props = defineProps({
  open: Boolean,
  services: { type: Array, default: () => [] },
  preset: { type: Object, default: null }, // { date, time }
})
const emit = defineEmits(['close', 'created'])
const config = useConfig()

const form = reactive({
  serviceId: '',
  extraIds: [],
  date: '',
  time: '',
  manual: false,
  manualTime: '',
  name: '',
  phone: '',
  email: '',
  notes: '',
})
const slots = ref([])
const slotsLoading = ref(false)
const slotsMessage = ref('')
const saving = ref(false)
let wantedTime = ''

const cuts = computed(() => props.services.filter((s) => s.type === 'corte' && s.active))
const extras = computed(() => props.services.filter((s) => s.type === 'adicional' && s.active))
const chosen = computed(() =>
  props.services.filter((s) => s.id === form.serviceId || form.extraIds.includes(s.id)),
)
const duration = computed(() => chosen.value.reduce((t, s) => t + s.duration, 0))
const total = computed(() => chosen.value.reduce((t, s) => t + s.price, 0))
const time = computed(() => (form.manual ? form.manualTime : form.time))
const canSave = computed(() => form.serviceId && form.date && time.value && form.name.trim() && form.phone.trim())

watch(
  () => props.open,
  (open) => {
    if (!open) return
    wantedTime = props.preset?.time || ''
    Object.assign(form, {
      serviceId: cuts.value[0]?.id || '',
      extraIds: [],
      date: props.preset?.date || config.value.today,
      time: '',
      manual: false,
      manualTime: wantedTime,
      name: '',
      phone: '',
      email: '',
      notes: '',
    })
    loadSlots()
  },
)

watch(
  () => [form.date, duration.value],
  () => {
    if (props.open) loadSlots()
  },
)

function toggleExtra(id) {
  const i = form.extraIds.indexOf(id)
  if (i >= 0) form.extraIds.splice(i, 1)
  else form.extraIds.push(id)
}

let slotRequest = 0
async function loadSlots() {
  if (!form.date || !duration.value) return
  const id = ++slotRequest
  slotsLoading.value = true
  try {
    const r = await admin.slots(form.date, duration.value)
    if (id !== slotRequest) return
    slots.value = r.slots
    slotsMessage.value = r.closed ? r.reason : r.slots.length ? '' : 'No hay horas libres este día.'
    if (wantedTime && r.slots.includes(wantedTime)) form.time = wantedTime
    wantedTime = ''
    if (form.time && !r.slots.includes(form.time)) form.time = ''
  } catch (e) {
    if (id === slotRequest) slotsMessage.value = e.message
  } finally {
    if (id === slotRequest) slotsLoading.value = false
  }
}

async function submit() {
  if (!canSave.value) return
  saving.value = true
  try {
    const appointment = await admin.createAppointment({
      serviceId: form.serviceId,
      extraIds: form.extraIds,
      date: form.date,
      time: time.value,
      force: form.manual,
      customer: { name: form.name, phone: form.phone, email: form.email },
      notes: form.notes,
    })
    toast('Cita agendada.')
    emit('created', appointment)
    emit('close')
  } catch (e) {
    toast(e.message, 'error', 5000)
    if (e.status === 409) loadSlots()
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AppModal :open="open" title="Nueva cita" width="640px" @close="emit('close')">
    <form class="form" @submit.prevent="submit">
      <fieldset>
        <legend class="eyebrow">Servicio</legend>
        <label class="field">
          <span class="label">Corte</span>
          <select v-model="form.serviceId" class="input">
            <option v-for="s in cuts" :key="s.id" :value="s.id">{{ s.name }} · {{ money(s.price) }} · {{ formatDuration(s.duration) }}</option>
          </select>
        </label>
        <div v-if="extras.length" class="field">
          <span class="label">Adicionales</span>
          <div class="chips">
            <button
              v-for="s in extras"
              :key="s.id"
              type="button"
              class="chip"
              :class="{ on: form.extraIds.includes(s.id) }"
              :aria-pressed="form.extraIds.includes(s.id)"
              @click="toggleExtra(s.id)"
            >
              <Icon v-if="form.extraIds.includes(s.id)" name="check" :size="13" :stroke="2.6" />
              {{ s.name }}
            </button>
          </div>
        </div>
        <p class="sum tabular">{{ formatDuration(duration) }} · <strong>{{ money(total) }}</strong></p>
      </fieldset>

      <fieldset>
        <legend class="eyebrow">Fecha y hora</legend>
        <label class="field">
          <span class="label">Fecha</span>
          <input v-model="form.date" class="input" type="date" required />
        </label>
        <SlotGrid v-if="!form.manual" v-model="form.time" :slots="slots" :loading="slotsLoading" :message="slotsMessage" />
        <label v-else class="field">
          <span class="label">Hora de inicio</span>
          <input v-model="form.manualTime" class="input" type="time" step="300" />
          <span class="hint">La hora manual no revisa la disponibilidad: úsala para atenciones fuera de horario.</span>
        </label>
        <label class="checkbox">
          <input v-model="form.manual" type="checkbox" />
          Ingresar hora manual
        </label>
      </fieldset>

      <fieldset class="client">
        <legend class="eyebrow">Cliente</legend>
        <label class="field">
          <span class="label">Nombre</span>
          <input v-model="form.name" class="input" maxlength="80" required />
        </label>
        <label class="field">
          <span class="label">Teléfono</span>
          <input v-model="form.phone" class="input" type="tel" maxlength="24" placeholder="+56 9 1234 5678" required />
        </label>
        <label class="field full">
          <span class="label">Correo <small>(opcional)</small></span>
          <input v-model="form.email" class="input" type="email" maxlength="120" />
        </label>
        <label class="field full">
          <span class="label">Notas <small>(opcional)</small></span>
          <textarea v-model="form.notes" class="input" maxlength="300" />
        </label>
      </fieldset>
    </form>

    <template #footer>
      <button type="button" class="btn btn-outline" @click="emit('close')">Cancelar</button>
      <button type="button" class="btn" :disabled="!canSave || saving" @click="submit">
        <span v-if="saving" class="spinner" />Agendar cita
      </button>
    </template>
  </AppModal>
</template>

<style scoped>
.form {
  display: grid;
  gap: 26px;
}
fieldset {
  display: grid;
  gap: 14px;
  margin: 0;
  padding: 0;
  border: none;
  min-width: 0;
}
legend {
  margin-bottom: 12px;
  padding: 0;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 14px;
  border: 1px solid var(--line-2);
  border-radius: 999px;
  background: var(--paper);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}
.chip:hover {
  border-color: var(--black);
}
.chip.on {
  border-color: var(--black);
  background: var(--black);
  color: var(--paper);
}
.sum {
  color: var(--ink-3);
  font-size: 13.5px;
}
.sum strong {
  color: var(--ink);
}
.client {
  grid-template-columns: 1fr 1fr;
}
.client legend,
.client .full {
  grid-column: 1 / -1;
}
@media (max-width: 560px) {
  .client {
    grid-template-columns: 1fr;
  }
}
</style>
