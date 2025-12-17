<template>
  <v-container class="fill-height d-flex align-center justify-center">
    <!-- 
      PAS 1: Formulari Email 
      Passem la prop :loading perquè el botó es bloquegi visualment mentre envia 
    -->
    <EmailForm
      v-if="step === 'email'"
      :loading="isLoading"
      @submitted="handleEmailSubmit"
    />

    <!-- 
      PAS 2: Formulari Codi 
      Quan l'usuari encerti el codi, s'executa handleCodeVerification
    -->
    <CodeForm
      v-else
      @verified="handleCodeVerification"
    />
  </v-container>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router'; // IMPRESCINDIBLE per canviar de pàgina
import EmailForm from '@/components/EmailForm.vue';
import CodeForm from '@/components/CodeForm.vue';
import { sendVerificationCode, verifyCode } from '@/services/authService';

// Inicialitzem el router
const router = useRouter();

// Variables d'estat
const step = ref('email');
const email = ref('');
const isLoading = ref(false); // Controla la rodeta de càrrega

// Funció 1: Enviar Email
const handleEmailSubmit = async (value) => {
  isLoading.value = true; // Activem càrrega
  try {
    // Cridem al backend (ara amb Mongo o el codi del company, és transparent)
    await sendVerificationCode(value);
    
    email.value = value;
    step.value = 'code'; // Passem a la pantalla següent
  } catch (error) {
    console.error(error);
    alert('Error enviant el codi. Comprova que el servidor estigui engegat.');
  } finally {
    isLoading.value = false; // Desactivem càrrega passi el que passi
  }
};

// Funció 2: Verificar Codi
const handleCodeVerification = async (code) => {
  try {
    await verifyCode(email.value, code);
    console.log('Login correcte!');
    
    // REDIRECCIÓ: Aquí és on enviem l'usuari a la llista d'alumnes ('/')
    router.push('/'); 
    
  } catch (error) {
    console.error(error);
    alert('Codi incorrecte o expirat.');
  }
};
</script>