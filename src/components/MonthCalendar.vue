<script setup>
import { computed, ref, watch } from 'vue'
import { addDays, longDate, monthLabel, shiftMonth, weekday } from '../utils/format'
import Icon from './Icon.vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  today: { type: String, required: true },
  max: { type: String, default: '' },
  // { 'YYYY-MM-DD': horas libres }. Si es null, todos los días del rango se pueden elegir.
  availability: { type: Object, default: null },
  loading: Boolean,
})
const emit = defineEmits(['update:modelValue'])

const WEEK = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const month = ref((props.modelValue || props.today).slice(0, 7))
watch(
  () => props.modelValue,
  (value) => {
    if (value) month.value = value.slice(0, 7)
  },
)

const canPrev = computed(() => month.value > props.today.slice(0, 7))
const canNext = computed(() => !props.max || month.value < props.max.slice(0, 7))

const cells = computed(() => {
  const first = `${month.value}-01`
  const list = Array.from({ length: (weekday(first) + 6) % 7 }, () => null)
  for (let d = first; d.startsWith(month.value); d = addDays(d, 1)) {
    const count = props.availability ? (props.availability[d] ?? 0) : null
    const outOfRange = d < props.today || (props.max && d > props.max)
    list.push({ date: d, day: Number(d.slice(8)), count, disabled: outOfRange || count === 0 })
  }
  return list
})

function label(cell) {
  if (cell.disabled) return `${longDate(cell.date)}, sin horas disponibles`
  return cell.count ? `${longDate(cell.date)}, ${cell.count} horas libres` : longDate(cell.date)
}
</script>

<template>
  <div class="cal" :class="{ loading }">
    <div class="cal-head">
      <button type="button" class="icon-btn" :disabled="!canPrev" aria-label="Mes anterior" @click="month = shiftMonth(month, -1)">
        <Icon name="chevron-left" />
      </button>
      <strong class="cal-title" aria-live="polite">{{ monthLabel(month) }}</strong>
      <button type="button" class="icon-btn" :disabled="!canNext" aria-label="Mes siguiente" @click="month = shiftMonth(month, 1)">
        <Icon name="chevron-right" />
      </button>
    </div>
    <div class="cal-grid">
      <span v-for="(w, i) in WEEK" :key="`w${i}`" class="cal-wd" aria-hidden="true">{{ w }}</span>
      <template v-for="(c, i) in cells" :key="c ? c.date : `e${i}`">
        <span v-if="!c" />
        <button
          v-else
          type="button"
          class="cal-day tabular"
          :class="{ selected: c.date === modelValue, today: c.date === today, free: c.count > 0 }"
          :disabled="c.disabled"
          :aria-pressed="c.date === modelValue"
          :aria-label="label(c)"
          @click="emit('update:modelValue', c.date)"
        >
          {{ c.day }}
        </button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.cal {
  transition: opacity 0.2s;
}
.cal.loading {
  opacity: 0.45;
  pointer-events: none;
}
.cal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.cal-title {
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 600;
}
.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}
.cal-wd {
  padding: 6px 0;
  color: var(--ink-4);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-align: center;
}
.cal-day {
  position: relative;
  aspect-ratio: 1;
  max-height: 48px;
  border: 1px solid transparent;
  border-radius: 999px;
  background: transparent;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s,
    border-color 0.15s;
}
.cal-day:hover:not(:disabled) {
  border-color: var(--black);
}
.cal-day:disabled {
  color: var(--line-2);
  font-weight: 500;
  cursor: default;
}
.cal-day.free::after {
  content: '';
  position: absolute;
  bottom: 6px;
  left: 50%;
  width: 4px;
  height: 4px;
  margin-left: -2px;
  border-radius: 50%;
  background: currentColor;
}
.cal-day.today:not(.selected) {
  border-color: var(--line-2);
  border-style: dashed;
}
.cal-day.selected {
  background: var(--black);
  color: var(--paper);
}
</style>
