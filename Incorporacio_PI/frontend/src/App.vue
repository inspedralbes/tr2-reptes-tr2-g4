<template>
  <v-app>
    <v-app-bar 
      v-if="showAppBar" 
      color="#333333" 
      elevation="0" 
      height="80"
      class="gencat-app-bar"
      theme="dark"
    >
      <div class="d-flex align-center h-100 ps-4" :class="{ 'cursor-pointer': showNavButtons }" @click="goDashboard">
        <img 
          src="/logo_generalitat_blanc.svg" 
          alt="Generalitat de Catalunya" 
          height="45"
          class="me-4"
        />
        <div class="d-none d-sm-flex border-s-md mx-2 h-50 align-self-center border-opacity-25" style="border-color: white !important;"></div>
        <div class="d-flex flex-column justify-center ms-2">
          <span class="text-overline font-weight-bold d-none d-sm-block text-grey-lighten-1" style="line-height: 1.2; letter-spacing: 1px;">
            Departament d'Educació
          </span>
          <span class="text-h6 font-weight-bold text-white text-truncate" style="line-height: 1.2;">
            Plataforma PI
          </span>
        </div>
      </div>

      <v-spacer></v-spacer>

      <div v-if="showNavButtons" class="d-flex align-center pe-2">
        
        <VoiceToolbar class="me-2" />

        <NotificationBell class="me-1" />

        <v-tooltip text="Historial de registres" location="bottom">
          <template v-slot:activator="{ props }">
            <v-btn 
              icon="mdi-history" 
              v-bind="props" 
              @click="router.push('/logs')" 
              variant="text"
            ></v-btn>
          </template>
        </v-tooltip>

        <v-divider vertical inset class="mx-2 my-auto bg-grey-lighten-2"></v-divider>

        <v-tooltip text="Tancar la sessió" location="bottom">
          <template v-slot:activator="{ props }">
            <v-btn 
              icon="mdi-logout" 
              v-bind="props" 
              @click="logout" 
              color="red-lighten-1"
              variant="text"
            ></v-btn>
          </template>
        </v-tooltip>
      </div>
    </v-app-bar>

    <v-main class="bg-grey-lighten-4">
      <router-view />
    </v-main>
  </v-app>
</template>

<script setup>
import { computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import NotificationBell from '@/components/NotificationBell.vue';
import VoiceToolbar from '@/components/VoiceToolbar.vue';

const router = useRouter();
const route = useRoute(); 

// --- LÓGICA DE VISIBILIDAD ---

// 1. ¿Debemos mostrar la barra negra? 
// SÍ, a menos que estemos en el Login.
const showAppBar = computed(() => {
  return route.name !== 'login';
});

// 2. ¿Debemos mostrar los botones (Micro, Salir, Notificaciones)?
// SÍ, pero SOLO si NO estamos en Login Y TAMPOCO en la Landing.
// *IMPORTANTE*: Asegúrate de que en tu router el nombre de la landing sea 'landing' o 'home'.
const showNavButtons = computed(() => {
  const isLogin = route.name === 'login';
  const isLanding = route.name === 'landing' || route.path === '/'; // Detecta la landing por nombre o ruta raíz
  
  return !isLogin && !isLanding;
});

const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('userEmail');
  localStorage.removeItem('userCenterCode');
  router.push('/login');
};

const goDashboard = () => {
  // Solo permitimos ir al dashboard si tenemos los botones activos (usuario logueado)
  if (showNavButtons.value) {
    router.push('/dashboard');
  }
};
</script>

<style scoped>
.cursor-pointer {
  cursor: pointer;
  user-select: none; 
}
.v-application {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
}
</style>