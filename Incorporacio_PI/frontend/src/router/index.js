/**
 * router/index.js
 */
import { createRouter, createWebHistory } from 'vue-router'

// Importaciones
import LandingPage from '@/pages/LandingPage.vue'
import LoginView from '@/pages/LoginView.vue'
import DashboardMenu from '@/pages/DashboardMenu.vue' // <--- NUEVO MENÚ
import StudentList from '@/components/StudentList.vue'
import AddStudent from '@/pages/AddStudent.vue';
import StudentDetail from '@/pages/StudentDetail.vue'
import Logs from '@/pages/Logs.vue'



const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'landing',
      component: LandingPage
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView
    },
    // 1. RUTA DASHBOARD -> Ahora es el MENÚ DE BOTONES
    {
      path: '/dashboard', 
      name: 'dashboard',
      component: DashboardMenu,
      meta: { requiresAuth: true } 
    },
    // 2. NUEVA RUTA -> Para el listado de alumnos
    {
      path: '/alumnos', 
      name: 'StudentList',
      component: StudentList,
      meta: { requiresAuth: true } 
    },
    // 3. RUTA FUTURA -> Insertar alumno (Aún no creada, dará error 404 o blanco si clickas)
    {
      path: '/nuevo-alumno',
      name: 'AddStudent',
      // Como no tienes la página, puedes poner temporalmente un componente vacío o el Dashboard
      component: AddStudent, 
      meta: { requiresAuth: true }
    },
    {
      path: '/perfil/:hash_id',
      name: 'StudentDetail',
      component: StudentDetail,
      meta: { requiresAuth: true }
    },
    // 4. RUTA LOGS -> Per veure l'historial d'accions
    {
      path: '/logs',
      name: 'Logs',
      component: Logs, // Crearem aquest fitxer ara
      meta: { requiresAuth: true }
    },
    // 5. RUTA RESUM IA -> Nova pàgina dedicada
    {
      path: '/resum/:filename',
      name: 'SummaryPage',
      component: () => import('@/pages/SummaryPage.vue'),
      meta: { requiresAuth: true }
    }
  ]
})

// GUARDIA DE SEGURIDAD (Igual que antes)
router.beforeEach((to, from, next) => {
  document.title = 'Plataforma PI';
  const necesitaAuth = to.matched.some(record => record.meta.requiresAuth)
  const isAuthenticated = localStorage.getItem('token')

  if (necesitaAuth && !isAuthenticated) {
    next('/login')
  } else if ((to.path === '/login' || to.path === '/') && isAuthenticated) {
    next('/dashboard')
  } else {
    next()
  }
})

export default router