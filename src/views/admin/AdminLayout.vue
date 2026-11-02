<script setup>
import { onBeforeUnmount, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { DEMO, session } from '../../api'
import BrandMark from '../../components/BrandMark.vue'
import Icon from '../../components/Icon.vue'
import { confirmResetDemo } from '../../demoReset'
import { loadConfig, useConfig } from '../../stores/config'
import { toast } from '../../toast'

const route = useRoute()
const router = useRouter()
const config = useConfig()

const NAV = [
  { name: 'admin-dashboard', label: 'Resumen', icon: 'grid' },
  { name: 'admin-agenda', label: 'Agenda', icon: 'calendar' },
  { name: 'admin-services', label: 'Servicios', icon: 'scissors' },
  { name: 'admin-settings', label: 'Ajustes', icon: 'sliders' },
]

function logout() {
  session.clear()
  router.replace({ name: 'admin-login' })
}

function onUnauthorized() {
  router.replace({ name: 'admin-login', query: { redirect: route.fullPath } })
}

onMounted(() => {
  window.addEventListener('admin:unauthorized', onUnauthorized)
  loadConfig().catch((e) => toast(e.message, 'error'))
})
onBeforeUnmount(() => window.removeEventListener('admin:unauthorized', onUnauthorized))
</script>

<template>
  <div class="admin">
    <aside class="sidebar">
      <div class="side-brand">
        <BrandMark :name="config?.business.name" inverse size="sm" />
      </div>
      <nav class="nav" aria-label="Panel">
        <RouterLink v-for="item in NAV" :key="item.name" :to="{ name: item.name }" class="nav-link" exact-active-class="active">
          <Icon :name="item.icon" :size="18" />
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>
      <div class="side-foot">
        <button v-if="DEMO" type="button" class="nav-link subtle" title="Versión demo: vuelve a los datos de ejemplo" @click="confirmResetDemo">
          <Icon name="refresh" :size="17" /><span>Reiniciar demo</span>
        </button>
        <a :href="router.resolve('/').href" target="_blank" rel="noopener" class="nav-link subtle">
          <Icon name="external" :size="17" /><span>Ver página de reservas</span>
        </a>
        <button type="button" class="nav-link subtle" @click="logout">
          <Icon name="logout" :size="17" /><span>Cerrar sesión</span>
        </button>
      </div>
      <div class="side-pole" aria-hidden="true" />
    </aside>

    <main class="content">
      <RouterView v-slot="{ Component }">
        <component :is="Component" v-if="config" />
        <div v-else class="loading"><span class="spinner" /></div>
      </RouterView>
    </main>
  </div>
</template>

<style scoped>
.admin {
  display: grid;
  grid-template-columns: 248px minmax(0, 1fr);
  min-height: 100vh;
  background: var(--paper-2);
}
.sidebar {
  position: sticky;
  top: 0;
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding: 24px 14px 20px;
  background: var(--black);
  color: var(--paper);
}
.side-brand {
  padding: 0 10px 28px;
}
.nav {
  display: grid;
  gap: 4px;
}
.nav-link {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  height: 44px;
  padding: 0 14px;
  border: none;
  border-radius: 12px;
  background: none;
  color: #b9b9b9;
  font-size: 14px;
  font-weight: 700;
  text-align: left;
  text-decoration: none;
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s;
}
.nav-link:hover {
  background: #1d1d1d;
  color: var(--paper);
}
.nav-link.active {
  background: var(--paper);
  color: var(--black);
}
.nav-link.subtle {
  height: 38px;
  font-size: 13px;
  font-weight: 600;
  color: #8d8d8d;
}
.side-foot {
  display: grid;
  gap: 2px;
  margin-top: auto;
  padding-top: 16px;
  border-top: 1px solid #222;
}
.side-pole {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 4px;
  background: repeating-linear-gradient(-45deg, var(--paper) 0 5px, var(--black) 5px 10px);
  opacity: 0.35;
}
.content {
  min-width: 0;
  padding: 36px clamp(18px, 4vw, 48px) 64px;
}
.loading {
  display: grid;
  place-items: center;
  padding: 80px 0;
}

@media (max-width: 900px) {
  .admin {
    grid-template-columns: 1fr;
  }
  .sidebar {
    position: sticky;
    z-index: 20;
    flex-direction: row;
    align-items: center;
    gap: 6px;
    height: auto;
    padding: 10px 12px;
  }
  .side-brand {
    padding: 0 6px 0 2px;
  }
  .side-brand :deep(.word) {
    display: none;
  }
  .nav {
    display: flex;
    flex: 1;
    gap: 2px;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .nav-link {
    width: auto;
    height: 38px;
    padding: 0 12px;
    gap: 8px;
    white-space: nowrap;
  }
  .side-foot {
    display: flex;
    margin: 0;
    padding: 0;
    border: none;
  }
  .side-foot .nav-link {
    width: 38px;
    padding: 0;
    justify-content: center;
  }
  .side-foot span {
    display: none;
  }
  .side-pole {
    top: auto;
    left: 0;
    width: auto;
    height: 3px;
  }
  .content {
    padding-top: 24px;
  }
}
@media (max-width: 560px) {
  .nav-link:not(.subtle) span {
    display: none;
  }
  .nav-link.active span {
    display: inline;
  }
}
</style>
