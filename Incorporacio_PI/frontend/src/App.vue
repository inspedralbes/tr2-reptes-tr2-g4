<template>
  <v-app>
    <v-app-bar v-if="$route.name !== 'login'" color="primary" elevation="2">
      <v-app-bar-title>Plataforma Normalització PI</v-app-bar-title>
      <template v-slot:append>
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
const route = useRoute(); // Para saber en qué página estamos

const logout = () => {
  localStorage.removeItem('token');
  router.push('/login');
};
</script>