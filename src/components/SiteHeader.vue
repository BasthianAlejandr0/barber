<script setup>
import BrandMark from './BrandMark.vue'
import Icon from './Icon.vue'

defineProps({ business: { type: Object, default: null } })
</script>

<template>
  <header class="site-header">
    <div class="container bar">
      <RouterLink to="/" class="home" aria-label="Inicio">
        <BrandMark :name="business?.name" inverse />
      </RouterLink>
      <nav class="contact" aria-label="Contacto">
        <a v-if="business?.instagram" :href="`https://instagram.com/${business.instagram}`" target="_blank" rel="noopener">
          <Icon name="instagram" :size="17" /><span>@{{ business.instagram }}</span>
        </a>
        <a v-if="business?.phone" :href="`tel:${business.phone.replace(/\s/g, '')}`">
          <Icon name="phone" :size="16" /><span>{{ business.phone }}</span>
        </a>
      </nav>
    </div>
  </header>
</template>

<style scoped>
.site-header {
  background: var(--black);
  color: var(--paper);
}
.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  height: 72px;
}
.home {
  text-decoration: none;
}
.contact {
  display: flex;
  gap: 20px;
}
.contact a {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  opacity: 0.85;
}
.contact a:hover {
  opacity: 1;
  text-decoration: underline;
  text-underline-offset: 3px;
}
@media (max-width: 640px) {
  .contact span {
    display: none;
  }
}
</style>
