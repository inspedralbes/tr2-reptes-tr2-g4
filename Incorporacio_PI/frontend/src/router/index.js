import { createRouter, createWebHistory } from 'vue-router'

import LandingPage from '@/pages/LandingPage.vue'
import LoginView from '@/pages/LoginView.vue'
import DashboardMenu from '@/pages/DashboardMenu.vue'
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
    {
      path: '/dashboard', 
      name: 'dashboard',
      component: DashboardMenu,
      meta: { requiresAuth: true } 
    },
    {
      path: '/alumnes', 
      name: 'StudentList',
      component: StudentList,
      meta: { requiresAuth: true } 
    },
    {
      path: '/nou-alumne',
      name: 'AddStudent',
      component: AddStudent, 
      meta: { requiresAuth: true }
    },
    {
      path: '/perfil/:hash_id',
      name: 'StudentDetail',
      component: StudentDetail,
      meta: { requiresAuth: true }
    },
    {
      path: '/logs',
      name: 'Logs',
      component: Logs, 
      meta: { requiresAuth: true }
    },
    {
      path: '/resum/:filename',
      name: 'SummaryPage',
      component: () => import('@/pages/SummaryPage.vue'),
      meta: { requiresAuth: true }
    }
  ]
})

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