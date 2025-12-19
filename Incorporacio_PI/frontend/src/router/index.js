/**
 * router/index.js
 * Configuración manual de rutas y seguridad
 */

import { createRouter, createWebHistory } from 'vue-router'

// 1. Importamos tus componentes/páginas manualmente
import LoginView from '@/pages/LoginView.vue'
import StudentList from '@/components/StudentList.vue'
import StudentDetail from '@/pages/StudentDetail.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: LoginView
    },
    {
      path: '/',
      name: 'dashboard',
      component: StudentList,
      meta: { requiresAuth: true } // 🔒 Marcamos esta ruta como protegida
    },
    {
      path: '/perfil',
      component: () => import('@/pages/Perfil.vue')
    },
    {
      path: '/perfil/:hash_id', // Los dos puntos : indican que es un parámetro dinámico
    name: 'StudentDetail',
    component: StudentDetail,
    }
  ]
})

// 2. GUARDIA DE NAVEGACIÓN (La seguridad)
// Esto se ejecuta antes de cada cambio de página
router.beforeEach((to, from, next) => {
  // Verificamos si la ruta a la que va requiere autenticación
  const necesitaAuth = to.matched.some(record => record.meta.requiresAuth)
  
  // Verificamos si tenemos el token guardado (simulado)
  const isAuthenticated = localStorage.getItem('token')

  if (necesitaAuth && !isAuthenticated) {
    // Si intenta entrar al dashboard sin token -> Al Login
    next('/login')
  } else if (to.path === '/login' && isAuthenticated) {
    // Si intenta ir al login pero ya tiene token -> Al Dashboard
    next('/')
  } else {
    // En cualquier otro caso, dejamos pasar
    next()
  }
})

export default router
