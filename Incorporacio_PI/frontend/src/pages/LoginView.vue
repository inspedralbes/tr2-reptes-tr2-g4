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
const isLoading = ref(false); // Esta variable es la clave

const handleEmailSubmit = async (value) => {
  isLoading.value = true;
  try {
    await sendVerificationCode(value);
    email.value = value;
    step.value = 'code';
  } catch (error) {
    console.error(error);
    alert('Error enviant el codi.');
  } finally {
    isLoading.value = false;
  }
};

const handleCodeVerification = async (code) => {
  // 1. Bloquem el botó perquè no es pugui fer doble clic
  isLoading.value = true; 
  
  try {
    // 2. Fem la petició al servidor
    const response = await verifyCode(email.value, code); 
    console.log('Login correcte! Resposta:', response);
    
    // 3. IMPORTANT: Guardem el token i l'usuari al navegador
    // Si no fem això, el router ens farà fora al intentar entrar a "/"
    if (response.token) {
        localStorage.setItem('token', response.token);
    }
    localStorage.setItem('userEmail', email.value);

    // 4. Ara sí, redirigim a la Home (Dashboard)
    router.push('/dashboard'); // Antes era '/'
    
  } catch (error) {
    console.error("Error al login:", error);
    alert('Codi incorrecte o expirat.');
    
    // Només desbloquem el botó si ha fallat. 
    // Si ha anat bé, deixem que giri fins que canviï de pàgina.
    isLoading.value = false;
  }
};
</script>