<template>
  <v-container class="fill-height d-flex align-center justify-center">
    <v-card class="pa-8 text-center" elevation="8" rounded="xl" max-width="400">
      <v-avatar color="primary" size="80" class="mb-4">
        <v-icon icon="mdi-account-key" size="40" color="white"></v-icon>
      </v-avatar>
      <h2 class="text-h5 font-weight-bold mb-2">Accés Directe</h2>
      <p class="text-body-2 text-grey mb-6">
        Entra directament a la gestió d'alumnes (Mode Sense Autenticació).
      </p>
      <v-btn
        block
        color="primary"
        size="large"
        rounded="pill"
        @click="handleDirectLogin"
        :loading="isLoading"
      >
        Entrar a la Plataforma
      </v-btn>
    </v-card>
  </v-container>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const isLoading = ref(false);

const handleDirectLogin = () => {
  isLoading.value = true;
  // Simulem un login guardant un token fictici per passar el router guard
  localStorage.setItem('token', 'bypass-token-mongodb-atlas');
  localStorage.setItem('userEmail', 'admin@centre.cat');
  
  // Redirigim directament a la llista d'alumnes
  setTimeout(() => {
    router.push('/alumnos');
  }, 500);
};
</script>