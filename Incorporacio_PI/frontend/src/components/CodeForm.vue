<template>
  <v-card class="pa-6" max-width="400">
    <v-card-title>Verificación</v-card-title>

    <v-card-text>
      <v-text-field
        v-model="code"
        label="Código de verificación"
        maxlength="6"
      />
    </v-card-text>

    <v-card-actions>
      <v-btn
        color="primary"
        block
        :loading="loading"
        @click="submit"
      >
        Verificar
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup>
import { ref } from 'vue';

const emit = defineEmits(['verified']);

const code = ref('');
const loading = ref(false);

const submit = async () => {
  if (!code.value) return;

  loading.value = true;
  await emit('verified', code.value);
  loading.value = false;
};
</script>
