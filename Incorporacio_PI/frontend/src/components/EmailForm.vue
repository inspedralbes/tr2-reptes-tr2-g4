<template>
  <v-form ref="form" @submit.prevent="submit" class="mt-2">
    
    <p class="text-body-2 text-grey-darken-3 mb-6">
      Seleccioneu el vostre centre educatiu o introduïu el correu corporatiu (xtec.cat) per rebre el codi d'accés.
    </p>

    <v-combobox
      v-model="selectedItem"
      :items="centros"
      :loading="loadingCentros"
      label="Cerca el teu centre o escriu l'email"
      placeholder="Ex: Institut..."
      prepend-inner-icon="mdi-magnify"
      variant="outlined"
      :rules="rules"
      :disabled="loading"
      item-title="displayTitle" 
      item-value="email"
      return-object
      auto-select-first
      clearable
      color="#D0021B" 
      base-color="grey-darken-1"
      bg-color="white"
      class="gencat-input mb-6"
    >
      <template v-slot:item="{ props, item }">
        <v-list-item v-bind="props" :subtitle="item.raw.email" density="compact">
          <template v-slot:prepend>
            <v-icon icon="mdi-domain" size="small" color="grey-darken-1"></v-icon>
          </template>
        </v-list-item>
      </template>

      <template v-slot:no-data>
        <v-list-item density="compact">
          <v-list-item-title class="text-body-2">
            No trobem el centre. <br>
            <span class="text-grey-darken-1">Pots escriure l'email manualment i prémer Enter.</span>
          </v-list-item-title>
        </v-list-item>
      </template>
    </v-combobox>

    <v-btn
      color="#D0021B"
      block
      size="large"
      type="submit"
      :loading="loading"
      elevation="0"
      class="text-white font-weight-bold gencat-btn"
      height="48"
    >
      ENVIAR CODI DE VERIFICACIÓ
    </v-btn>

  </v-form>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const props = defineProps({
  loading: Boolean
});

const emit = defineEmits(['submitted']);

const form = ref(null);
const centros = ref([]);
const loadingCentros = ref(false);
const selectedItem = ref(null);

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:3001');

const rules = [
  v => !!v || 'El correu o centre és obligatori',
  v => {
    const emailToCheck = (typeof v === 'object' && v !== null) ? v.email : v;
    return /.+@.+\..+/.test(emailToCheck) || 'Introdueix un correu vàlid';
  }
];

onMounted(async () => {
  loadingCentros.value = true;
  try {
    const response = await fetch(`${API_URL}/api/centros`);
    if (response.ok) {
      const data = await response.json();
      centros.value = data.map(c => ({
        ...c,
        displayTitle: `${c.denominacio_completa} (${c.codi_centre})`
      }));
    }
  } catch (error) {
    console.error("Error carregant centres:", error);
  } finally {
    loadingCentros.value = false;
  }
});

const submit = async () => {
  const { valid } = await form.value.validate();

  if (valid) {
    let emailToSend = '';
    let centerCodeToSend = null; 

    if (typeof selectedItem.value === 'object' && selectedItem.value !== null) {
      emailToSend = selectedItem.value.email;
      centerCodeToSend = selectedItem.value.codi_centre; 
    } else {
      emailToSend = selectedItem.value;
    }

    emit('submitted', { 
        email: emailToSend.trim().toLowerCase(),
        codiCentre: centerCodeToSend 
    });
  }
};
</script>

<style scoped>
.gencat-btn {
  border-radius: 4px !important;
  letter-spacing: 0.5px;
}

.border-red {
  border: 1px solid #ffcdd2;
}

:deep(.v-field__outline__start),
:deep(.v-field__outline__end),
:deep(.v-field__outline__notch) {
  border-color: rgba(0,0,0,0.3) !important;
}
</style>