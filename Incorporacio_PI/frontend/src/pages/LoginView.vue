<template>
  <v-container class="fill-height d-flex align-center justify-center">
    
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

    <!-- Opcional: Un snackbar per mostrar errors de forma maca -->
    <v-snackbar v-model="showError" color="error">
      {{ errorMessage }}
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
const isLoading = ref(false);

// Per mostrar errors
const showError = ref(false);
const errorMessage = ref('');

const handleEmailSubmit = async (payload) => {
  // 'payload' ara conté { email, token }
  isLoading.value = true;
  try {
    // Enviem les dues coses al servei
    await sendVerificationCode(payload.email, payload.token);
    
    // Si tot va bé:
    email.value = payload.email;
    step.value = 'code';
  } catch (error) {
    console.error(error);
    
    // GESTIÓ D'ERRORS (Bloqueig IP / Captcha incorrecte)
    if (error.response && error.response.data && error.response.data.error) {
        // Mostrem l'error específic que envia el backend (Ex: "Massa intents...")
        errorMessage.value = error.response.data.error;
    } else if (error.response && error.response.status === 429) {
        errorMessage.value = "Has superat el límit d'intents. Torna-ho a provar en 15 minuts.";
    } else {
        errorMessage.value = "Error enviant el codi. Revisa la consola.";
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

    router.push('/dashboard'); 
    
  } catch (error) {
    // Gestió d'errors al verificar codi
    if (error.response && error.response.data && error.response.data.message) {
        errorMessage.value = error.response.data.message;
    } else if (error.response && error.response.status === 429) {
        errorMessage.value = "Massa intents de codi incorrecte. Espera uns minuts.";
    } else {
        errorMessage.value = "Codi incorrecte o error del servidor.";
    }
    showError.value = true;
    isLoading.value = false;
  }
};
</script>