<template>
  <div class="mt-2 text-center">
    
    <v-avatar color="grey-lighten-4" size="60" class="mb-4">
      <v-icon icon="mdi-email-lock" size="32" color="#D0021B"></v-icon>
    </v-avatar>

    <h3 class="text-h6 font-weight-bold text-grey-darken-3 mb-2">
      Verificació de Seguretat
    </h3>
    <p class="text-body-2 text-grey-darken-1 mb-6 px-4">
      Hem enviat un codi de 6 dígits al teu correu electrònic. Introdueix-lo a continuació.
    </p>

    <v-text-field
      v-model="code"
      placeholder="000000"
      variant="outlined"
      maxlength="6"
      @keyup.enter="submit"
      :disabled="loading"
      autofocus
      color="#D0021B" 
      base-color="grey-darken-1"
      bg-color="white"
      class="gencat-input-code mb-6 centered-input"
      hide-details="auto"
    ></v-text-field>

    <v-btn
      color="#D0021B"
      block
      size="large"
      :loading="loading" 
      :disabled="loading"
      @click="submit"
      elevation="0"
      class="text-white font-weight-bold gencat-btn"
      height="48"
    >
      VERIFICAR I ACCEDIR
    </v-btn>

    <div class="mt-4">
      <button 
        class="text-caption text-grey-darken-1 text-decoration-underline cursor-pointer bg-transparent border-0"
        @click="$emit('resend')" 
        type="button"
      >
        No has rebut el codi?
      </button>
    </div>

  </div>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({
  loading: Boolean
});

const emit = defineEmits(['verified', 'resend']);
const code = ref('');

const submit = () => {
  if (!code.value || props.loading) return;
  emit('verified', code.value);
};
</script>

<style scoped>
.gencat-btn {
  border-radius: 4px !important;
  letter-spacing: 0.5px;
}

/* CORRECCIÓ: Ataquem directament l'input intern de Vuetify */
.centered-input :deep(input) {
  text-align: center;
  font-size: 1.5rem;      /* Números grans */
  letter-spacing: 0.5em;  /* Separats */
  font-family: monospace, sans-serif;
}

/* Ajustar el color de la vora */
:deep(.v-field__outline__start),
:deep(.v-field__outline__end),
:deep(.v-field__outline__notch) {
  border-color: rgba(0,0,0,0.3) !important;
}

.cursor-pointer {
  cursor: pointer;
}
</style>