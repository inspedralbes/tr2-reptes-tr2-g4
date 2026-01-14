<template>
  <v-container class="fill-height bg-grey-lighten-5" fluid>
    
    <div class="gencat-top-bar"></div>

    <v-row justify="center" align="center">
      <v-col cols="12" sm="10" md="8" lg="5">
        
        <v-card class="text-center pa-8 pa-md-12 gencat-card" elevation="1" rounded="lg">
          
          <div class="mb-10 d-flex justify-center">
            <img src="/logo_gencat.png" alt="Generalitat de Catalunya" height="45" class="me-4" />
          </div>

          <h2 class="text-overline text-grey-darken-1 mb-2 font-weight-bold tracking-wide">
            DEPARTAMENT D'EDUCACIÓ I FORMACIÓ PROFESSIONAL
          </h2>

          <h1 class="text-h4 font-weight-black text-grey-darken-4 mb-6 gencat-font">
            Plataforma PI
          </h1>
          
          <p class="text-body-1 text-grey-darken-3 mb-10 mx-auto" style="max-width: 500px; line-height: 1.6;">
            Sistema centralitzat per a la gestió, normalització i seguiment dels Plans Individualitzats entre centres educatius.
          </p>

          <v-divider class="mb-10"></v-divider>

          <v-btn
            block
            color="#D0021B" 
            size="x-large"
            elevation="0"
            class="text-none font-weight-bold px-8 mb-4 gencat-btn text-white"
            height="56"
            @click="handleNavigation"
            :loading="loading"
          >
            {{ hasToken ? 'Accedir al Tauler de Control' : 'Inicia la sessió' }}
            <v-icon end icon="mdi-arrow-right" class="ml-2"></v-icon>
          </v-btn>

           <v-btn
            v-if="!hasToken"
            variant="text"
            color="grey-darken-3"
            class="text-none text-caption text-decoration-underline"
            href="#"
          >
            Necessiteu ajuda per accedir-hi?
          </v-btn>

        </v-card>

        <div class="text-center mt-8 footer-links">
          <p class="text-caption text-grey-darken-1 font-weight-bold mb-2">
            © 2026 Generalitat de Catalunya
          </p>
          <div class="d-flex justify-center gap-4">
             <a href="#" class="text-caption text-grey-darken-1 mx-2 text-decoration-none">Avís legal</a>
             <a href="#" class="text-caption text-grey-darken-1 mx-2 text-decoration-none">Privacitat</a>
             <a href="#" class="text-caption text-grey-darken-1 mx-2 text-decoration-none">Accessibilitat</a>
          </div>
        </div>

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
  hasToken.value = !!localStorage.getItem('token');
});

const handleNavigation = () => {
  loading.value = true;
  // Simulem una petita càrrega per efecte visual
  setTimeout(() => {
    if (hasToken.value) {
      router.push('/dashboard');
    } else {
      router.push('/login');
    }
    loading.value = false;
  }, 500);
};
</script>

<style scoped>
/* ESTILS ESPECÍFICS GENCAT */

/* Barra superior vermella fixa */
.gencat-top-bar {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 4px;
  background-color: #D0021B; /* Vermell oficial */
  z-index: 10;
}

/* Fonts del sistema per màxima llegibilitat (com la web real) */
.gencat-font {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
}

.gencat-card {
  border: 1px solid rgba(0,0,0,0.1) !important;
}

/* Botó amb vores només lleugerament arrodonides (4px) */
.gencat-btn {
  border-radius: 4px !important; 
  letter-spacing: 0.5px;
}

.tracking-wide {
  letter-spacing: 2px !important;
}

/* Enllaços del footer */
.footer-links a:hover {
  text-decoration: underline !important;
  color: #000 !important;
}
</style>