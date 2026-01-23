<template>
  <v-container class="fill-height bg-grey-lighten-5" fluid>
    
    <div class="gencat-top-bar"></div>

    <v-row justify="center" align="center">
      <v-col cols="12" sm="8" md="6" lg="4">
        
        <div class="mb-2">
          <v-btn 
            variant="text" 
            prepend-icon="mdi-arrow-left" 
            class="text-none px-0 text-grey-darken-2 hover-underline"
            :ripple="false"
            @click="router.push('/')"
          >
            Tornar a l'inici
          </v-btn>
        </div>

        <v-card class="pa-8 gencat-card" elevation="1" rounded="lg">
          
          <div class="text-center mb-8">
            <img src="/logo_gencat.png" alt="Generalitat de Catalunya" height="45" class="me-4" />
            <h2 class="text-overline text-grey-darken-1 font-weight-bold tracking-wide">
              DEPARTAMENT D'EDUCACIÓ
            </h2>
            <h1 class="text-h5 font-weight-black text-grey-darken-4 mt-2">
              Accés a la Plataforma
            </h1>
          </div>

          <div class="form-container">
            <EmailForm
              v-if="step === 'email'"
              :loading="isLoading"
              @submitted="handleEmailSubmit"
            />

            <CodeForm
              v-else
              :loading="isLoading"
              @verified="handleCodeVerification"
            />
          </div>
          
          <div class="text-center mt-6">
             <a href="#" class="text-caption text-grey-darken-1 text-decoration-underline">
               Problemes per accedir-hi?
             </a>
          </div>

        </v-card>

        <div class="text-center mt-6">
          <p class="text-caption text-grey">© 2026 Generalitat de Catalunya</p>
        </div>

      </v-col>
    </v-row>

    <v-snackbar v-model="showError" color="#D0021B" location="top" variant="flat">
      <div class="d-flex align-center">
        <v-icon icon="mdi-alert-circle" color="white" class="mr-2"></v-icon>
        {{ errorMessage }}
      </div>
      <template v-slot:actions>
        <v-btn color="white" variant="text" @click="showError = false">Tancar</v-btn>
      </template>
    </v-snackbar>

  </v-container>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import EmailForm from '@/components/EmailForm.vue';
import CodeForm from '@/components/CodeForm.vue';
import { sendVerificationCode, verifyCode } from '@/services/authService';

const router = useRouter();
const step = ref('email');
const email = ref('');
const tempCenterCode = ref(null);
const isLoading = ref(false);

const showError = ref(false);
const errorMessage = ref('');

const handleEmailSubmit = async (payload) => {
  isLoading.value = true;
  try {
    // -------------------------------------------------------------
    // CORRECCIÓ AQUÍ:
    // Passem TOTS els paràmetres que ens envia l'EmailForm.
    // payload.token serà el Captcha (Web) o null (Electron)
    // payload.isDesktop serà true (Electron) o false (Web)
    // -------------------------------------------------------------
    await sendVerificationCode(
      payload.email, 
      payload.token, 
      payload.isDesktop
    );
    
    email.value = payload.email;
    tempCenterCode.value = payload.codiCentre; 
    
    step.value = 'code';
  } catch (error) {
    console.error(error);
    if (error.response && error.response.data && error.response.data.error) {
        errorMessage.value = error.response.data.error;
    } else if (error.response && error.response.status === 429) {
        errorMessage.value = "Has superat el límit d'intents. Torna-ho a provar més tard.";
    } else {
        errorMessage.value = "Error enviant el codi.";
    }
    showError.value = true;
  } finally {
    isLoading.value = false;
  }
};

const handleCodeVerification = async (code) => {
  isLoading.value = true; 
  try {
    const response = await verifyCode(email.value, code); 
    
    if (response.token) {
        localStorage.setItem('token', response.token);
    }
    
    localStorage.setItem('userEmail', email.value);

    if (tempCenterCode.value) {
        localStorage.setItem('userCenterCode', tempCenterCode.value);
    } else {
        localStorage.removeItem('userCenterCode');
    }

    router.push('/dashboard');
  } catch (error) {
    if (error.response && error.response.data && error.response.data.message) {
        errorMessage.value = error.response.data.message;
    } else if (error.response && error.response.status === 429) {
        errorMessage.value = "Massa intents. Espera uns minuts.";
    } else {
        errorMessage.value = "Codi incorrecte o error del servidor.";
    }
    showError.value = true;
    isLoading.value = false;
  }
};
</script>

<style scoped>
.gencat-top-bar {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 4px;
  background-color: #D0021B;
  z-index: 10;
}

.gencat-card {
  border: 1px solid rgba(0,0,0,0.1) !important;
}

.tracking-wide {
  letter-spacing: 2px !important;
}

.hover-underline:hover {
  text-decoration: underline;
  background-color: transparent !important;
}

.v-container, .v-card {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
}
</style>