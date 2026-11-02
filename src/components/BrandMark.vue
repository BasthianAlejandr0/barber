<script setup>
import { computed } from 'vue'

const props = defineProps({
  name: { type: String, default: 'Amílcar Barbero' },
  inverse: Boolean,
  size: { type: String, default: 'md' },
})

// "Amílcar Barbero" → "Amílcar" en grande y "Barbero" como bajada.
const parts = computed(() => {
  const words = (props.name || 'Amílcar Barbero').trim().split(/\s+/)
  return words.length > 1 ? { main: words.slice(0, -1).join(' '), sub: words.at(-1) } : { main: words[0], sub: '' }
})
const initial = computed(() => parts.value.main.charAt(0).toUpperCase())
</script>

<template>
  <span class="brand" :class="[{ inverse }, size]">
    <span class="mark" aria-hidden="true">{{ initial }}</span>
    <span class="word">
      <span class="main">{{ parts.main }}</span>
      <span v-if="parts.sub" class="sub">{{ parts.sub }}</span>
    </span>
  </span>
</template>

<style scoped>
.brand {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  color: var(--black);
  text-decoration: none;
}
.brand.inverse {
  color: var(--paper);
}
.mark {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  flex: none;
  border: 1.5px solid currentColor;
  border-radius: 50%;
  outline: 1px solid currentColor;
  outline-offset: 3px;
  font-family: var(--font-display);
  font-size: 19px;
  font-style: italic;
  line-height: 1;
  padding-bottom: 1px;
}
.word {
  display: grid;
  line-height: 1;
}
.main {
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.sub {
  margin-top: 4px;
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.42em;
  text-transform: uppercase;
  opacity: 0.75;
}
.sm .mark {
  width: 28px;
  height: 28px;
  font-size: 16px;
}
.sm .main {
  font-size: 16px;
}
.sm .sub {
  font-size: 8.5px;
}
</style>
