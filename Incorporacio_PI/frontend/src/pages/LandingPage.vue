<template>
  <v-container class="fill-height bg-grey-lighten-4" fluid>
    <v-row justify="center" align="center">
      <v-col cols="12" sm="10" md="8" lg="6">
        
        <v-card class="text-center pa-10" elevation="10" rounded="xl">
          <div class="mb-6">
            <v-avatar color="primary" size="100">
              <v-icon icon="mdi-school-outline" size="60" color="white"></v-icon>
            </v-avatar>
          </div>

          <h1 class="text-h3 font-weight-bold text-primary mb-4">
            Plataforma PI
          </h1>
          
          <p class="text-h6 text-grey-darken-1 mb-8">
            Sistema centralizado para la gestión, normalización y seguimiento de Planes Individualizados entre centros educativos.
          </p>

          <v-divider class="mb-8"></v-divider>

          <v-btn
            color="primary"
            size="x-large"
            rounded="pill"
            elevation="4"
            prepend-icon="mdi-login-variant"
            @click="handleNavigation"
            :loading="loading"
          >
            {{ hasToken ? 'Ir a mi Panel de Control' : 'Acceder a la Plataforma' }}
          </v-btn>
        </v-card>

        <p class="text-caption text-center mt-6 text-grey">
          © 2025 Departament d'Educació - Generalitat de Catalunya
        </p>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const hasToken = ref(false);
const loading = ref(false);

onMounted(() => {
  // Comprobamos si hay token guardado
  hasToken.value = !!localStorage.getItem('token');
});

const handleNavigation = () => {
  loading.value = true;
  if (hasToken.value) {
    router.push('/dashboard');
  } else {
    router.push('/login');
  }
  loading.value = false;
};
</script>