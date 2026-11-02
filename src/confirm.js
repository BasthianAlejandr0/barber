import { reactive } from 'vue'

export const confirmState = reactive({
  open: false,
  title: '',
  message: '',
  confirmText: 'Confirmar',
  cancelText: 'Volver',
  resolve: null,
})

/** Diálogo de confirmación que devuelve una promesa con true/false. */
export function confirmDialog(options) {
  confirmState.resolve?.(false)
  return new Promise((resolve) => {
    Object.assign(confirmState, { message: '', confirmText: 'Confirmar', cancelText: 'Volver', ...options, open: true, resolve })
  })
}

export function settleConfirm(value) {
  const { resolve } = confirmState
  Object.assign(confirmState, { open: false, resolve: null })
  resolve?.(value)
}
