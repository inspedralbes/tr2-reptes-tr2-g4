<template>
  <v-container class="fill-height d-flex align-center justify-center">
    <EmailForm
      v-if="step === 'email'"
      @submitted="handleEmailSubmit"
    />

    <CodeForm
      v-else
      @verified="handleCodeVerification"
    />
  </v-container>
</template>

<script setup>
import { ref } from 'vue';
import EmailForm from '@/components/EmailForm.vue';
import CodeForm from '@/components/CodeForm.vue';
import { sendVerificationCode, verifyCode } from '@/services/authService';

const step = ref('email');
const email = ref('');

const handleEmailSubmit = async (value) => {
  await sendVerificationCode(value);
  email.value = value;
  step.value = 'code';
};

const handleCodeVerification = async (code) => {
  try {
    await verifyCode(email.value, code);
    console.log('Login correcto');
    // Aquí rediriges al dashboard
  } catch (error) {
    alert('Código incorrecto');
  }
};
</script>
