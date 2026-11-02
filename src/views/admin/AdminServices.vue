<script setup>
import { computed, onMounted, ref } from 'vue'
import { admin } from '../../api'
import AppModal from '../../components/AppModal.vue'
import Icon from '../../components/Icon.vue'
import { confirmDialog } from '../../confirm'
import { toast } from '../../toast'
import { formatDuration, money } from '../../utils/format'

const list = ref([])
const loading = ref(true)
const editing = ref(null)
const saving = ref(false)

const DURATIONS = Array.from({ length: 36 }, (_, i) => (i + 1) * 5)

const groups = computed(() => [
  {
    type: 'corte',
    title: 'Cortes',
    hint: 'El servicio principal. El cliente elige uno.',
    items: list.value.filter((s) => s.type === 'corte'),
  },
  {
    type: 'adicional',
    title: 'Servicios adicionales',
    hint: 'Extras opcionales que se suman al corte, en precio y en tiempo.',
    items: list.value.filter((s) => s.type === 'adicional'),
  },
])

async function load() {
  try {
    list.value = await admin.services()
  } catch (e) {
    toast(e.message, 'error')
  } finally {
    loading.value = false
  }
}
onMounted(load)

function openNew(type) {
  editing.value = {
    type,
    name: '',
    description: '',
    price: type === 'corte' ? 10000 : 3000,
    duration: type === 'corte' ? 30 : 15,
    active: true,
  }
}
const openEdit = (service) => (editing.value = { ...service })

async function save() {
  const s = editing.value
  saving.value = true
  try {
    if (s.id) await admin.updateService(s.id, s)
    else await admin.createService(s)
    toast(s.id ? 'Servicio actualizado.' : 'Servicio creado.')
    editing.value = null
    load()
  } catch (e) {
    toast(e.message, 'error')
  } finally {
    saving.value = false
  }
}

async function toggle(service) {
  try {
    const updated = await admin.updateService(service.id, { active: !service.active })
    Object.assign(service, updated)
    toast(updated.active ? `«${updated.name}» ahora se puede reservar.` : `«${updated.name}» quedó oculto para los clientes.`)
  } catch (e) {
    toast(e.message, 'error')
  }
}

async function remove(service) {
  const ok = await confirmDialog({
    title: `¿Eliminar «${service.name}»?`,
    message: 'Las citas ya agendadas con este servicio se mantienen. Si solo quieres dejar de ofrecerlo por un tiempo, ocúltalo con el interruptor.',
    confirmText: 'Eliminar',
  })
  if (!ok) return
  try {
    await admin.deleteService(service.id)
    toast('Servicio eliminado.')
    load()
  } catch (e) {
    toast(e.message, 'error')
  }
}
</script>

<template>
  <div>
    <header class="page-head">
      <div>
        <p class="eyebrow">Catálogo</p>
        <h1 class="page-title">Servicios</h1>
        <p class="page-sub">Lo que tus clientes pueden reservar, con su precio y duración.</p>
      </div>
    </header>

    <div v-if="loading" class="stack">
      <span v-for="n in 2" :key="n" class="skeleton" style="height: 260px; border-radius: 16px" />
    </div>

    <div v-else class="stack">
      <section v-for="g in groups" :key="g.type" class="card group">
        <header class="group-head">
          <div>
            <h2 class="section-title">{{ g.title }}</h2>
            <p class="muted small">{{ g.hint }}</p>
          </div>
          <button type="button" class="btn btn-sm" @click="openNew(g.type)"><Icon name="plus" :size="15" />Agregar</button>
        </header>

        <ul v-if="g.items.length" class="items">
          <li v-for="s in g.items" :key="s.id" :class="{ hidden: !s.active }">
            <div class="info">
              <strong>{{ s.name }}</strong>
              <span v-if="s.description" class="desc">{{ s.description }}</span>
            </div>
            <span class="dur tabular"><Icon name="clock" :size="14" />{{ formatDuration(s.duration) }}</span>
            <span class="price tabular">{{ g.type === 'adicional' ? '+ ' : '' }}{{ money(s.price) }}</span>
            <label class="visible" :title="s.active ? 'Visible para clientes' : 'Oculto para clientes'">
              <span class="switch">
                <input type="checkbox" :checked="s.active" :aria-label="`Mostrar ${s.name} a los clientes`" @change="toggle(s)" />
                <span />
              </span>
              <span class="vis-label">{{ s.active ? 'Visible' : 'Oculto' }}</span>
            </label>
            <div class="row-actions">
              <button type="button" class="icon-btn" :aria-label="`Editar ${s.name}`" title="Editar" @click="openEdit(s)">
                <Icon name="edit" :size="17" />
              </button>
              <button type="button" class="icon-btn" :aria-label="`Eliminar ${s.name}`" title="Eliminar" @click="remove(s)">
                <Icon name="trash" :size="17" />
              </button>
            </div>
          </li>
        </ul>
        <div v-else class="empty">
          <strong>Aún no hay {{ g.type === 'corte' ? 'cortes' : 'servicios adicionales' }}</strong>
          <span>Agrega el primero para que aparezca en la página de reservas.</span>
        </div>
      </section>
    </div>

    <AppModal :open="!!editing" :title="editing?.id ? 'Editar servicio' : 'Nuevo servicio'" width="520px" @close="editing = null">
      <form v-if="editing" class="form" @submit.prevent="save">
        <label class="field full">
          <span class="label">Nombre</span>
          <input v-model="editing.name" class="input" maxlength="60" required placeholder="Ej: Fade con diseño" />
        </label>
        <label class="field full">
          <span class="label">Descripción <small>(opcional)</small></span>
          <input v-model="editing.description" class="input" maxlength="160" placeholder="Una línea que lo explique" />
        </label>
        <label class="field">
          <span class="label">Tipo</span>
          <select v-model="editing.type" class="input">
            <option value="corte">Corte (principal)</option>
            <option value="adicional">Adicional</option>
          </select>
        </label>
        <label class="field">
          <span class="label">Duración</span>
          <select v-model.number="editing.duration" class="input">
            <option v-for="d in DURATIONS" :key="d" :value="d">{{ formatDuration(d) }}</option>
          </select>
        </label>
        <label class="field">
          <span class="label">Precio (CLP)</span>
          <input v-model.number="editing.price" class="input tabular" type="number" min="0" step="500" required />
          <span class="hint">{{ money(editing.price) }}</span>
        </label>
        <label class="checkbox visible-check">
          <input v-model="editing.active" type="checkbox" />
          Visible para clientes
        </label>
      </form>
      <template #footer>
        <button type="button" class="btn btn-outline" @click="editing = null">Cancelar</button>
        <button type="button" class="btn" :disabled="saving || !editing?.name?.trim()" @click="save">
          <span v-if="saving" class="spinner" />Guardar
        </button>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.stack {
  display: grid;
  gap: 18px;
}
.group-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 20px;
  border-bottom: 1px solid var(--line);
}
.small {
  font-size: 13px;
}
.items {
  margin: 0;
  padding: 0;
  list-style: none;
}
.items li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 96px 104px 112px auto;
  align-items: center;
  gap: 16px;
  padding: 14px 20px;
  border-bottom: 1px solid var(--line);
}
.items li:last-child {
  border-bottom: none;
}
.items li.hidden .info,
.items li.hidden .dur,
.items li.hidden .price {
  opacity: 0.45;
}
.info {
  display: grid;
  min-width: 0;
}
.info strong {
  font-size: 15px;
}
.desc {
  overflow: hidden;
  color: var(--ink-3);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dur {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--ink-2);
  font-size: 13.5px;
  font-weight: 600;
}
.price {
  font-size: 15px;
  font-weight: 800;
  text-align: right;
}
.visible {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  cursor: pointer;
}
.vis-label {
  color: var(--ink-3);
  font-size: 12.5px;
  font-weight: 700;
}
.row-actions {
  display: flex;
  gap: 2px;
}
.form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.form .full {
  grid-column: 1 / -1;
}
.visible-check {
  align-self: center;
  margin-top: 6px;
}
@media (max-width: 760px) {
  .items li {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 6px 14px;
  }
  .info {
    grid-column: 1 / -1;
  }
  .dur {
    grid-row: 2;
  }
  .price {
    grid-row: 2;
    text-align: left;
  }
  .visible {
    grid-row: 3;
  }
  .row-actions {
    grid-row: 3;
    justify-self: end;
  }
}
@media (max-width: 480px) {
  .form {
    grid-template-columns: 1fr;
  }
}
</style>
