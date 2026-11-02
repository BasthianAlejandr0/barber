<script setup>
import { computed } from 'vue'
import { toMin } from '../utils/format'
import Icon from './Icon.vue'

const props = defineProps({
  slots: { type: Array, default: () => [] },
  modelValue: { type: String, default: '' },
  loading: Boolean,
  message: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])

const groups = computed(() =>
  [
    { label: 'Mañana', items: props.slots.filter((t) => toMin(t) < 12 * 60) },
    { label: 'Tarde', items: props.slots.filter((t) => toMin(t) >= 12 * 60 && toMin(t) < 19 * 60) },
    { label: 'Noche', items: props.slots.filter((t) => toMin(t) >= 19 * 60) },
  ].filter((g) => g.items.length),
)
</script>

<template>
  <!-- Si ya hay horas en pantalla, se atenúan mientras recarga para que el formulario no salte. -->
  <div class="slots" :class="{ stale: loading && slots.length }" :aria-busy="loading">
    <div v-if="loading && !slots.length" class="grid">
      <span v-for="n in 8" :key="n" class="skeleton" style="height: 42px" />
    </div>
    <div v-else-if="!slots.length" class="empty">
      <Icon name="clock" :size="24" />
      <span>{{ message || 'Elige un día para ver las horas.' }}</span>
    </div>
    <template v-else>
      <div v-for="g in groups" :key="g.label" class="group">
        <p class="eyebrow">{{ g.label }}</p>
        <div class="grid" role="group" :aria-label="g.label">
          <button
            v-for="t in g.items"
            :key="t"
            type="button"
            class="slot tabular"
            :class="{ selected: t === modelValue }"
            :aria-pressed="t === modelValue"
            @click="emit('update:modelValue', t)"
          >
            {{ t }}
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.slots {
  transition: opacity 0.15s;
}
.slots.stale {
  opacity: 0.45;
  pointer-events: none;
}
.group + .group {
  margin-top: 18px;
}
.group .eyebrow {
  margin-bottom: 9px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(78px, 1fr));
  gap: 8px;
}
.slot {
  height: 42px;
  border: 1px solid var(--line-2);
  border-radius: var(--radius-sm);
  background: var(--paper);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s,
    border-color 0.15s;
}
.slot:hover {
  border-color: var(--black);
}
.slot.selected {
  border-color: var(--black);
  background: var(--black);
  color: var(--paper);
}
.empty {
  padding: 28px 12px;
}
</style>
