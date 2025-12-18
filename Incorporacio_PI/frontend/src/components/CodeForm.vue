<template>
  <v-card class="pa-6" max-width="400">
    <v-card-title>Verificación</v-card-title>

    <v-card-text>
      <v-text-field
        v-model="code"
        label="Código de verificación"
        maxlength="6"
        @keyup.enter="submit"
      />
    </v-card-text>

    <v-card-actions>
      <v-btn
        color="primary"
        block
        :loading="loading" 
        :disabled="loading"
        @click="submit"
      >
        Verificar
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup>
import { ref } from 'vue';

// 1. Recibimos la orden de bloqueo desde el padre
const props = defineProps({
  loading: Boolean
});

const emit = defineEmits(['verified']);
const code = ref('');

const submit = () => {
  // Si ya está cargando o no hay código, no hacemos nada
  if (!code.value || props.loading) return;

  // Emitimos el evento. El padre (LoginView) pondrá loading = true
  emit('verified', code.value);
};
</script>