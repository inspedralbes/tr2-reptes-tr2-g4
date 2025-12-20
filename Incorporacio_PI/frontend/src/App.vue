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

const router = useRouter();
const route = useRoute(); 

const logout = () => {
  localStorage.removeItem('token');
  router.push('/login');
};

// Nueva función para ir al Dashboard
const goDashboard = () => {
  // Si estamos logueados, vamos al menú principal
  // Si no, nos mandará al login automáticamente por el router guard
  router.push('/dashboard');
};
</script>

<style scoped>
/* Clase para cambiar el cursor y evitar que se seleccione el texto al hacer doble clic */
.cursor-pointer {
  cursor: pointer;
  user-select: none; 
}

/* Opcional: Un pequeño efecto al pasar el ratón */
.title-hover:hover {
  opacity: 0.9;
}
</style>