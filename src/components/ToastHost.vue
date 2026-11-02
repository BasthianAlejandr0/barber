<script setup>
import { toasts } from '../toast'
import Icon from './Icon.vue'
</script>

<template>
  <div class="toasts" role="status" aria-live="polite">
    <TransitionGroup name="toast">
      <div v-for="t in toasts" :key="t.id" class="toast" :class="t.type">
        <Icon :name="t.type === 'error' ? 'alert' : 'check'" :size="17" />
        <span>{{ t.message }}</span>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toasts {
  position: fixed;
  bottom: calc(20px + env(safe-area-inset-bottom));
  left: 50%;
  z-index: 80;
  display: grid;
  justify-items: center;
  gap: 8px;
  width: min(92vw, 440px);
  transform: translateX(-50%);
  pointer-events: none;
}
.toast {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 18px;
  border: 1.5px solid var(--black);
  border-radius: 999px;
  background: var(--black);
  color: var(--paper);
  box-shadow: var(--shadow);
  font-size: 14px;
  font-weight: 600;
}
.toast.error {
  background: var(--paper);
  color: var(--black);
}
.toast-enter-active,
.toast-leave-active {
  transition: all 0.25s var(--ease);
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
