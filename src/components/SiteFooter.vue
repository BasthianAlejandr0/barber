<script setup>
import Icon from './Icon.vue'

defineProps({ business: { type: Object, default: null } })
const year = new Date().getFullYear()
</script>

<template>
  <footer class="site-footer">
    <div class="pole" aria-hidden="true" />
    <div class="container inner">
      <div class="info">
        <strong class="name">{{ business?.name || 'Amílcar Barbero' }}</strong>
        <span v-if="business?.address"><Icon name="pin" :size="15" />{{ business.address }}</span>
        <span v-if="business?.phone"><Icon name="phone" :size="15" />{{ business.phone }}</span>
      </div>
      <div class="legal">
        <span>© {{ year }}</span>
        <RouterLink to="/admin">Acceso barbero</RouterLink>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.site-footer {
  margin-top: 72px;
  background: var(--black);
  color: var(--paper);
}
.inner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-top: 28px;
  padding-bottom: 28px;
  font-size: 13px;
}
.info {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 22px;
}
.info span {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  opacity: 0.75;
}
.name {
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.04em;
}
.legal {
  display: flex;
  gap: 18px;
  opacity: 0.6;
}
.legal a {
  text-underline-offset: 3px;
}
</style>
