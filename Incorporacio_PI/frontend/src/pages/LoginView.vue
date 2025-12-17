<template>
  <v-container class="fill-height d-flex align-center justify-center">
    <EmailForm
      v-if="step === 'email'"
      :loading="loading"
      @submitted="handleEmailSubmit"
    />

    <CodeForm
      v-else
      :loading="loading"
      @verified="handleCodeVerification"
    />
    
    <v-snackbar v-model="showError" color="error">
      {{ errorMessage }}
    </v-snackbar>
  </v-container>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router'; // Importar router
import EmailForm from '@/components/EmailForm.vue';
import CodeForm from '@/components/CodeForm.vue';
import { sendVerificationCode, verifyCode } from '@/services/authService';

const router = useRouter(); // Instancia del router
const step = ref('email');
const email = ref('');
const loading = ref(false);
const showError = ref(false);
const errorMessage = ref('');

const handleEmailSubmit = async (value) => {
  loading.value = true;
  try {
    await sendVerificationCode(value);
    email.value = value;
    step.value = 'code';
  } catch (error) {
    errorMessage.value = "Error enviando código";
    showError.value = true;
  } finally {
    loading.value = false;
  }
};

const handleCodeVerification = async (code) => {
  loading.value = true;
  try {
    const response = await verifyCode(email.value, code);
    
    if (response.success) {
      // Guardamos el token (simulado) para persistencia
      localStorage.setItem('token', response.token);
      
      console.log('Login correcto, redirigiendo...');
      router.push('/'); // REDIRECCIÓN AL DASHBOARD
    }
  } catch (error) {
    errorMessage.value = "Código incorrecto";
    showError.value = true;
  } finally {
    loading.value = false;
  }
};
</script>