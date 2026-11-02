<script setup>
import { confirmState, settleConfirm } from '../confirm'
import AppModal from './AppModal.vue'
</script>

<template>
  <AppModal :open="confirmState.open" :title="confirmState.title" width="440px" @close="settleConfirm(false)">
    <p class="message">{{ confirmState.message }}</p>
    <template #footer>
      <button type="button" class="btn btn-outline" @click="settleConfirm(false)">{{ confirmState.cancelText }}</button>
      <button type="button" class="btn" @click="settleConfirm(true)">{{ confirmState.confirmText }}</button>
    </template>
  </AppModal>
</template>

<style scoped>
.message {
  color: var(--ink-2);
}
</style>
