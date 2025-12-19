/**
 * router/index.js
 */
import { createRouter, createWebHistory } from 'vue-router'

// Importaciones
import LandingPage from '@/pages/LandingPage.vue' // <--- NUEVO
import LoginView from '@/pages/LoginView.vue'
import StudentList from '@/components/StudentList.vue'
import StudentDetail from '@/pages/StudentDetail.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'landing',
      component: LandingPage
      // NO tiene 'requiresAuth', es pública
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView
    },
    {
      path: '/dashboard', // <--- CAMBIO IMPORTANTE: Antes era '/'
      name: 'dashboard',
      component: StudentList,
      meta: { requiresAuth: true } // 🔒 Privada
    },
    {
      path: '/alumno/:hash_id',
      name: 'StudentDetail',
      component: StudentDetail,
      meta: { requiresAuth: true } // 🔒 Privada
    },
    // Redirección por si alguien entra en /perfil sin ID (opcional)
    {
      path: '/perfil',
      redirect: '/dashboard'
    }
  ]
})

// GUARDIA DE SEGURIDAD
router.beforeEach((to, from, next) => {
  const necesitaAuth = to.matched.some(record => record.meta.requiresAuth)
  const isAuthenticated = localStorage.getItem('token')

  // 1. Si intenta entrar a sitio privado sin token -> Login
  if (necesitaAuth && !isAuthenticated) {
    next('/login')
  } 
  // 2. Si ya tiene token y quiere ir al Login o a la Landing -> Dashboard
  // (Así no tienen que ver la portada si ya están logueados)
  else if ((to.path === '/login' || to.path === '/') && isAuthenticated) {
    next('/dashboard')
  } 
  else {
    next()
  }
})

export default router