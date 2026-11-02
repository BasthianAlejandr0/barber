import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router'
import { DEMO, session } from './api'
import BookingView from './views/BookingView.vue'

const routes = [
  { path: '/', name: 'booking', component: BookingView },
  { path: '/cita/:code', name: 'appointment', component: () => import('./views/AppointmentView.vue') },
  { path: '/admin/login', name: 'admin-login', component: () => import('./views/admin/AdminLogin.vue'), meta: { title: 'Ingresar' } },
  {
    path: '/admin',
    component: () => import('./views/admin/AdminLayout.vue'),
    meta: { admin: true },
    children: [
      { path: '', name: 'admin-dashboard', component: () => import('./views/admin/AdminDashboard.vue'), meta: { title: 'Resumen' } },
      { path: 'agenda', name: 'admin-agenda', component: () => import('./views/admin/AdminAgenda.vue'), meta: { title: 'Agenda' } },
      { path: 'servicios', name: 'admin-services', component: () => import('./views/admin/AdminServices.vue'), meta: { title: 'Servicios' } },
      { path: 'ajustes', name: 'admin-settings', component: () => import('./views/admin/AdminSettings.vue'), meta: { title: 'Ajustes' } },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  // GitHub Pages no sabe redirigir rutas como /admin a index.html, así que la demo usa #/admin.
  history: DEMO ? createWebHashHistory() : createWebHistory(),
  routes,
  scrollBehavior: (to, from, saved) => saved || { top: 0 },
})

router.beforeEach((to) => {
  if (to.matched.some((r) => r.meta.admin) && !session.token) {
    return { name: 'admin-login', query: { redirect: to.fullPath } }
  }
  if (to.name === 'admin-login' && session.token) return { name: 'admin-dashboard' }
})

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · Panel Amílcar Barbero` : 'Reserva tu hora · Amílcar Barbero'
})

export default router
