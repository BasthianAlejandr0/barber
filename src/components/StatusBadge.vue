<script setup>
import { STATUS_LABEL } from '../utils/format'

defineProps({ status: { type: String, required: true } })
</script>

<template>
  <span class="badge" :class="`badge-${status}`">{{ STATUS_LABEL[status] || status }}</span>
</template>
