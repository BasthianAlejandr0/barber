<script>
// Pila compartida: con dos modales abiertos, Escape cierra solo el de arriba
// y el scroll del fondo se libera cuando se cierra el último.
const stack = []
</script>

<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import Icon from './Icon.vue'

const props = defineProps({
  open: Boolean,
  title: { type: String, default: '' },
  width: { type: String, default: '560px' },
})
const emit = defineEmits(['close'])

const panel = ref(null)
const self = Symbol('modal')
let lastFocus = null

function onKey(e) {
  if (e.key === 'Escape' && stack.at(-1) === self) emit('close')
}

function release() {
  const i = stack.indexOf(self)
  if (i === -1) return
  stack.splice(i, 1)
  document.removeEventListener('keydown', onKey)
  if (!stack.length) document.body.style.overflow = ''
}

watch(
  () => props.open,
  async (open) => {
    if (open) {
      lastFocus = document.activeElement
      stack.push(self)
      document.addEventListener('keydown', onKey)
      document.body.style.overflow = 'hidden'
      await nextTick()
      panel.value?.focus()
    } else if (stack.includes(self)) {
      release()
      lastFocus?.focus?.()
    }
  },
  { immediate: true },
)

onBeforeUnmount(release)
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="backdrop" @mousedown.self="emit('close')">
        <div ref="panel" class="modal" role="dialog" aria-modal="true" :aria-label="title" tabindex="-1" :style="{ maxWidth: width }">
          <header class="head">
            <h2>{{ title }}</h2>
            <button type="button" class="icon-btn" aria-label="Cerrar" @click="emit('close')"><Icon name="x" /></button>
          </header>
          <div class="body"><slot /></div>
          <footer v-if="$slots.footer" class="foot"><slot name="footer" /></footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgb(10 10 10 / 0.55);
  backdrop-filter: blur(3px);
}
.modal {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-height: min(88vh, 880px);
  border-radius: var(--radius);
  background: var(--paper);
  box-shadow: 0 30px 80px -20px rgb(0 0 0 / 0.5);
  outline: none;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 18px 14px 24px;
  border-bottom: 1px solid var(--line);
}
.head h2 {
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 600;
}
.body {
  padding: 22px 24px;
  overflow-y: auto;
}
.foot {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 24px 18px;
  border-top: 1px solid var(--line);
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s;
}
.modal-enter-active .modal,
.modal-leave-active .modal {
  transition: transform 0.25s var(--ease);
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from .modal,
.modal-leave-to .modal {
  transform: translateY(16px) scale(0.98);
}

@media (max-width: 640px) {
  .backdrop {
    place-items: end stretch;
    padding: 0;
  }
  .modal {
    max-width: none !important;
    max-height: 92vh;
    border-radius: var(--radius) var(--radius) 0 0;
  }
  .body {
    padding: 18px 18px;
  }
  .foot {
    padding: 12px 18px calc(14px + env(safe-area-inset-bottom));
  }
  .foot :deep(.btn) {
    flex: 1;
  }
}
</style>
