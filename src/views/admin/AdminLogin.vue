<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { DEMO, admin, session } from '../../api'
import BrandMark from '../../components/BrandMark.vue'
import Icon from '../../components/Icon.vue'

const route = useRoute()
const router = useRouter()
const password = ref('')
const error = ref('')
const loading = ref(false)

async function submit() {
  if (!password.value) {
    error.value = 'Ingresa la contraseña.'
    return
  }
  loading.value = true
  error.value = ''
  try {
    const { token } = await admin.login(password.value)
    session.set(token)
    const redirect = String(route.query.redirect || '')
    router.replace(redirect.startsWith('/admin') ? redirect : { name: 'admin-dashboard' })
  } catch (e) {
    error.value = e.message
    password.value = ''
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login">
    <section class="side">
      <BrandMark inverse />
      <div>
        <p class="eyebrow">Panel del barbero</p>
        <h1 class="display">La agenda,<br /><em>en orden.</em></h1>
      </div>
      <div class="stripes" aria-hidden="true" />
    </section>

    <section class="form-side">
      <form class="form" @submit.prevent="submit">
        <span class="lock"><Icon name="lock" :size="22" /></span>
        <h2 class="display">Ingresar</h2>
        <p class="muted">Accede para ver y gestionar las reservas.</p>
        <label class="field">
          <span class="label">Contraseña</span>
          <input
            v-model="password"
            class="input"
            :class="{ invalid: error }"
            type="password"
            autocomplete="current-password"
            autofocus
          />
          <span v-if="error" class="field-error" role="alert"><Icon name="alert" :size="14" />{{ error }}</span>
          <span v-else-if="DEMO" class="hint">Demo: la contraseña es <strong>amilcar2026</strong></span>
        </label>
        <button type="submit" class="btn btn-block" :disabled="loading">
          <span v-if="loading" class="spinner" />
          {{ loading ? 'Ingresando…' : 'Ingresar' }}
        </button>
        <RouterLink to="/" class="back"><Icon name="arrow-left" :size="15" />Volver a la página de reservas</RouterLink>
      </form>
    </section>
  </div>
</template>

<style scoped>
.login {
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 100vh;
}
.side {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 40px;
  overflow: hidden;
  padding: 40px 48px;
  background: var(--black);
  color: var(--paper);
}
.side .eyebrow {
  color: var(--ink-4);
  margin-bottom: 14px;
}
.side h1 {
  font-size: clamp(44px, 5.6vw, 72px);
  line-height: 0.98;
  letter-spacing: -0.03em;
}
.side h1 em {
  font-weight: 400;
}
.stripes {
  position: absolute;
  top: 0;
  right: 48px;
  bottom: 0;
  width: 26px;
  background: repeating-linear-gradient(-45deg, var(--paper) 0 10px, var(--black) 10px 20px);
  opacity: 0.9;
}
.form-side {
  display: grid;
  place-items: center;
  padding: 40px 24px;
}
.form {
  display: grid;
  gap: 18px;
  width: 100%;
  max-width: 360px;
}
.lock {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border: 1.5px solid var(--black);
  border-radius: 50%;
}
.form h2 {
  font-size: 34px;
  margin-bottom: -10px;
}
.back {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: var(--ink-3);
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
}
.back:hover {
  color: var(--ink);
}
@media (max-width: 820px) {
  .login {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }
  .side {
    padding: 28px 24px 32px;
  }
  .side h1 {
    font-size: 40px;
  }
  .stripes {
    top: auto;
    left: 0;
    right: 0;
    width: auto;
    height: 8px;
  }
}
</style>
