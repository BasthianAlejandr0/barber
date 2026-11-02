<script setup>
import QRCode from 'qrcode'
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from '../toast'
import Icon from './Icon.vue'

const props = defineProps({ businessName: { type: String, default: 'Amílcar Barbero' } })

const url = new URL(useRouter().resolve('/').href, location.href).href
const qr = ref('')
const whatsapp = `https://wa.me/?text=${encodeURIComponent(`Reserva tu hora en ${props.businessName}: ${url}`)}`

onMounted(async () => {
  qr.value = await QRCode.toDataURL(url, { margin: 1, width: 480, color: { dark: '#0a0a0a', light: '#ffffff' } })
})

async function copy() {
  try {
    await navigator.clipboard.writeText(url)
    toast('Enlace copiado.')
  } catch {
    toast('No pudimos copiar el enlace.', 'error')
  }
}
</script>

<template>
  <section class="share card">
    <div class="text">
      <p class="eyebrow">Tu enlace de reservas</p>
      <h3 class="display">Compártelo y llena la agenda</h3>
      <p class="muted">Pégalo en tu bio de Instagram, envíalo por WhatsApp o imprime el QR para el mesón.</p>
      <div class="url">
        <Icon name="link" :size="16" />
        <span class="tabular">{{ url }}</span>
      </div>
      <div class="buttons">
        <button type="button" class="btn btn-sm" @click="copy"><Icon name="copy" :size="15" />Copiar</button>
        <a :href="whatsapp" target="_blank" rel="noopener" class="btn btn-sm btn-outline"><Icon name="message" :size="15" />WhatsApp</a>
        <a v-if="qr" :href="qr" download="qr-reservas.png" class="btn btn-sm btn-outline"><Icon name="download" :size="15" />QR</a>
      </div>
    </div>
    <div class="qr">
      <img v-if="qr" :src="qr" alt="Código QR del enlace de reservas" />
      <span v-else class="skeleton" />
    </div>
  </section>
</template>

<style scoped>
.share {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 150px;
  gap: 22px;
  align-items: center;
  padding: 22px;
}
.text {
  display: grid;
  gap: 8px;
  min-width: 0;
}
h3 {
  font-size: 24px;
}
.url {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  padding: 10px 14px;
  border: 1px dashed var(--line-2);
  border-radius: var(--radius-sm);
  background: var(--paper-2);
  font-size: 13.5px;
  font-weight: 700;
}
.url span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 6px;
}
.qr img,
.qr .skeleton {
  display: block;
  width: 150px;
  height: 150px;
  border: 1px solid var(--line);
  border-radius: 12px;
}
@media (max-width: 560px) {
  .share {
    grid-template-columns: 1fr;
  }
  .qr {
    display: none;
  }
}
</style>
