<script setup>
import { confirmResetDemo } from '../demoReset'
import Icon from './Icon.vue'
</script>

<template>
  <div class="demo-banner" role="note">
    <Icon name="alert" :size="15" />
    <p><strong>Versión demo.</strong> Las reservas se guardan solo en este navegador y no le llegan a la barbería.</p>
    <button type="button" @click="confirmResetDemo">Reiniciar datos</button>
  </div>
</template>

<style scoped>
.demo-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 16px;
  border-bottom: 1px solid var(--line);
  background: var(--hatch);
  color: var(--ink-2);
  font-size: 13px;
}
.demo-banner :deep(svg) {
  flex: none;
}
strong {
  color: var(--ink);
}
button {
  flex: none;
  padding: 0;
  border: 0;
  background: none;
  color: var(--ink);
  font: inherit;
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}
@media (max-width: 640px) {
  .demo-banner {
    justify-content: flex-start;
    font-size: 12.5px;
  }
}
</style>
