<template>
  <v-app>
    <v-app-bar v-if="$route.name !== 'login'" color="primary" elevation="2">
      
      <v-app-bar-title 
        class="cursor-pointer title-hover" 
        @click="goDashboard"
      >
        Plataforma Normalització PI
      </v-app-bar-title>

      <template v-slot:append>
        <NotificationBell class="me-2" />

        <v-btn icon="mdi-history" @click="router.push('/logs')" class="me-2"></v-btn>
        <v-btn icon="mdi-logout" @click="logout"></v-btn>
      </template>
    </v-app-bar>

    <v-main class="bg-grey-lighten-4">
      <router-view />
    </v-main>
  </v-app>
</template>

<script setup>
import { useRouter, useRoute } from 'vue-router';
// 2. IMPORTAMOS EL COMPONENTE
import NotificationBell from '@/components/NotificationBell.vue'; 

const router = useRouter();
const route = useRoute(); 

const logout = () => {
  localStorage.removeItem('token');
  router.push('/login');
};

const goDashboard = () => {
  router.push('/dashboard');
};
</script>

<style scoped>
.cursor-pointer {
  cursor: pointer;
  user-select: none; 
}

.title-hover:hover {
  opacity: 0.9;
}
</style>