<template>
  <v-container class="fill-height bg-grey-lighten-5" fluid>
    
    <div class="gencat-top-bar"></div>

    <v-row justify="center" align="center">
      <v-col cols="12" sm="10" md="8" lg="6" xl="5">
        
        <v-card class="gencat-card text-center overflow-hidden" elevation="1" rounded="lg">
          
          <div class="bg-white pt-10 pb-6 px-8 border-b">
            <div class="mb-6 d-flex justify-center">
              <img 
                src="/logo_generalitat_blanc.svg" 
                alt="Generalitat de Catalunya" 
                height="55" 
                class="logo-dark"
              />
            </div>

            <h2 class="text-overline text-grey-darken-1 font-weight-bold tracking-wide mb-0">
              DEPARTAMENT D'EDUCACIÓ I FORMACIÓ PROFESSIONAL
            </h2>
          </div>

          <div class="pa-8 pa-md-12 bg-white">
            
            <h1 class="text-h4 font-weight-black text-grey-darken-4 mb-4 gencat-font">
              Plataforma de Gestió PI
            </h1>
            
            <p class="text-body-1 text-grey-darken-1 mb-10 mx-auto" style="max-width: 600px; line-height: 1.6;">
              Entorn centralitzat per a la creació, normalització i intercanvi segur de Plans Individualitzats entre centres educatius de Catalunya.
            </p>

            <v-row class="mb-10 text-left justify-center">
                <v-col cols="12" sm="4">
                    <div class="d-flex flex-column align-center text-center">
                        <v-avatar color="red-lighten-5" size="56" class="mb-3">
                            <v-icon icon="mdi-file-document-check-outline" color="#D0021B" size="28"></v-icon>
                        </v-avatar>
                        <h3 class="text-subtitle-2 font-weight-bold text-grey-darken-3">Normalització</h3>
                        <p class="text-caption text-grey-darken-1 mt-1">Format unificat per a tots els expedients.</p>
                    </div>
                </v-col>
                <v-col cols="12" sm="4">
                    <div class="d-flex flex-column align-center text-center">
                        <v-avatar color="red-lighten-5" size="56" class="mb-3">
                            <v-icon icon="mdi-shield-check-outline" color="#D0021B" size="28"></v-icon>
                        </v-avatar>
                        <h3 class="text-subtitle-2 font-weight-bold text-grey-darken-3">Seguretat</h3>
                        <p class="text-caption text-grey-darken-1 mt-1">Accés controlat i auditoria de dades.</p>
                    </div>
                </v-col>
                <v-col cols="12" sm="4">
                    <div class="d-flex flex-column align-center text-center">
                        <v-avatar color="red-lighten-5" size="56" class="mb-3">
                            <v-icon icon="mdi-domain" color="#D0021B" size="28"></v-icon>
                        </v-avatar>
                        <h3 class="text-subtitle-2 font-weight-bold text-grey-darken-3">Interoperabilitat</h3>
                        <p class="text-caption text-grey-darken-1 mt-1">Connexió directa entre centres.</p>
                    </div>
                </v-col>
            </v-row>

            <div class="d-flex justify-center">
                <v-btn
                    color="#D0021B" 
                    size="x-large"
                    elevation="0"
                    class="text-none font-weight-bold px-10 gencat-btn text-white w-100 w-sm-auto"
                    height="54"
                    @click="handleNavigation"
                    :loading="loading"
                >
                    {{ hasToken ? 'Accedir al Tauler' : 'Iniciar Sessió' }}
                    <v-icon end icon="mdi-arrow-right" class="ml-2"></v-icon>
                </v-btn>
            </div>

            <div class="mt-6">
                <v-btn
                    v-if="!hasToken"
                    variant="text"
                    color="grey-darken-2"
                    size="small"
                    class="text-none text-decoration-underline"
                    href="#"
                >
                    Guia d'usuari i suport tècnic
                </v-btn>
            </div>

          </div>
        </v-card>

        <div class="text-center mt-8 footer-links">
          <p class="text-caption text-grey-darken-1 font-weight-bold mb-2">
            © 2026 Generalitat de Catalunya
          </p>
          <div class="d-flex justify-center flex-wrap gap-4">
              <a href="#" class="text-caption text-grey-darken-1 mx-2 text-decoration-none hover-link">Avís legal</a>
              <span class="text-grey-lighten-1">•</span>
              <a href="#" class="text-caption text-grey-darken-1 mx-2 text-decoration-none hover-link">Privacitat</a>
              <span class="text-grey-lighten-1">•</span>
              <a href="#" class="text-caption text-grey-darken-1 mx-2 text-decoration-none hover-link">Accessibilitat</a>
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
  // Comprovem si l'usuari ja té sessió iniciada
  hasToken.value = !!localStorage.getItem('token');
});

const handleNavigation = () => {
  loading.value = true;
  // Simulem una micro-càrrega per feedback visual
  setTimeout(() => {
    if (hasToken.value) {
      router.push('/dashboard');
    } else {
      router.push('/login');
    }
    loading.value = false;
  }, 400);
};
</script>

<style scoped>
/* ESTILS GENCAT */

.gencat-top-bar {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 4px;
  background-color: #D0021B;
  z-index: 10;
}

.gencat-font {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
}

.gencat-card {
  border: 1px solid rgba(0,0,0,0.08) !important;
  background-color: white;
}

.gencat-btn {
  border-radius: 4px !important; 
  letter-spacing: 0.5px;
  font-size: 1.1rem;
}

.tracking-wide {
  letter-spacing: 1.5px !important;
}

/* TRUC CSS: Convertim el logo blanc SVG a Negre/Gris Fosc */
.logo-dark {
  filter: invert(1) brightness(0.2); 
  /* Això fa que el logo_generalitat_blanc.svg es vegi gris fosc gairebé negre */
}

/* Footer links */
.hover-link:hover {
  text-decoration: underline !important;
  color: #000 !important;
}
</style>