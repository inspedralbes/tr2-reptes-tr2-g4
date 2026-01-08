<template>
  <v-card class="pa-6" elevation="4" max-width="450" rounded="lg">
    <div class="text-center mb-4">
      <v-icon icon="mdi-account-circle" size="64" color="primary"></v-icon>
      <v-card-title class="text-h5 font-weight-bold">Accés Usuari</v-card-title>
      <v-card-subtitle>Introdueix el teu correu corporatiu</v-card-subtitle>
    </div>

    <v-form ref="form" @submit.prevent="submit">
      <v-card-text>
        <v-text-field
          v-model="email"
          label="Correu electrònic"
          placeholder="nombre@gencat.cat"
          prepend-inner-icon="mdi-email-outline"
          variant="outlined"
          :rules="rules"
          :disabled="loading" 
          type="email"
          required
        />
      </v-card-text>

      <v-card-actions>
        <v-btn
          color="primary"
          block
          size="large"
          type="submit"
          :loading="loading"
        >
          Enviar codi
        </v-btn>
      </v-card-actions>
    </v-form>
  </v-card>
</template>

<script setup>
import { ref } from 'vue';

// 1. Recibimos 'loading' del padre. No lo definimos como ref local.
const props = defineProps({
  loading: Boolean
});

const emit = defineEmits(['submitted']);

const email = ref('');
const form = ref(null);

// Reglas básicas de validación
const rules = [
  v => !!v || 'El correu és obligatori',
  v => /.+@.+\..+/.test(v) || 'Introdueix un correu vàlid'
];

const submit = async () => {
  // 2. Validamos antes de emitir
  const { valid } = await form.value.validate();
  
  if (valid) {
    // Solo emitimos el valor. El padre se encarga de poner loading = true
    emit('submitted', email.value);
  }
};
</script>