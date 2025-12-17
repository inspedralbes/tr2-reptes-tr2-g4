<template>
  <v-card class="pa-6" max-width="400">
    <v-card-title>Acceso</v-card-title>

    <v-card-text>
      <v-text-field
        v-model="email"
        label="Correo electrónico"
        type="email"
        required
      />
    </v-card-text>

    <v-card-actions>
      <v-btn
        color="primary"
        block
        :loading="loading"
        @click="submit"
      >
        Enviar código
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup>
import { ref } from 'vue';

const emit = defineEmits(['submitted']);

const email = ref('');
const loading = ref(false);

const submit = async () => {
  if (!email.value) return;

  loading.value = true;
  await emit('submitted', email.value);
  loading.value = false;
};
</script>
