<script setup>
import { useRoute } from 'vue-router'
import { DEMO } from './api'
import ConfirmHost from './components/ConfirmHost.vue'
import DemoBanner from './components/DemoBanner.vue'
import ToastHost from './components/ToastHost.vue'

const route = useRoute()
</script>

<template>
  <!-- En el panel el aviso va en la barra lateral para no desplazar su altura fija. -->
  <DemoBanner v-if="DEMO && !route.path.startsWith('/admin')" />
  <RouterView />
  <ToastHost />
  <ConfirmHost />
</template>
