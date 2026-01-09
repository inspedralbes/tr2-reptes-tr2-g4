<template>
  <v-card class="pa-6" elevation="4" max-width="500" rounded="lg">
    <div class="text-center mb-4">
      <v-icon icon="mdi-school" size="64" color="primary"></v-icon>
      <v-card-title class="text-h5 font-weight-bold">Accés Centres</v-card-title>
      <v-card-subtitle>Busca el teu centre o introdueix el correu</v-card-subtitle>
    </div>

    <v-form ref="form" @submit.prevent="submit">
      <v-card-text>
        <!-- CANVI: Usamos v-combobox en lloc de v-text-field -->
        <v-combobox
          v-model="selectedItem"
          :items="centros"
          :loading="loadingCentros"
          label="Nom del centre, Codi o Email"
          placeholder="Ex: Escola Fabra"
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          :rules="rules"
          :disabled="loading"
          item-title="displayTitle" 
          item-value="email"
          return-object
          auto-select-first
          clearable
          hint="Pots escriure el nom de l'escola i seleccionarem el correu automàticament."
          persistent-hint
        >
          <!-- PERSONALITZACIÓ DE LA LLISTA DESPLEGABLE -->
          <template v-slot:item="{ props, item }">
            <v-list-item v-bind="props" :subtitle="item.raw.email">
              <template v-slot:prepend>
                <v-icon icon="mdi-domain" color="grey"></v-icon>
              </template>
            </v-list-item>
          </template>

          <!-- SI NO TROBA RES -->
          <template v-slot:no-data>
            <v-list-item>
              <v-list-item-title>
                Cap centre trobat. <br>
                <small class="text-grey">Pots escriure el teu email manualment i prémer Enter.</small>
              </v-list-item-title>
            </v-list-item>
          </template>
        </v-combobox>

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
import { ref, onMounted, computed } from 'vue';

const props = defineProps({
  loading: Boolean
});

const emit = defineEmits(['submitted']);

const form = ref(null);
const centros = ref([]);
const loadingCentros = ref(false);
const selectedItem = ref(null);

// Regles de validació
const rules = [
  v => !!v || 'El correu o centre és obligatori',
  v => {
    // Validem si és un objecte (seleccionat de la llista) o un string (escrit manualment)
    const emailToCheck = (typeof v === 'object' && v !== null) ? v.email : v;
    return /.+@.+\..+/.test(emailToCheck) || 'Introdueix un correu vàlid';
  }
];

// Càrrega de dades del Backend
onMounted(async () => {
  loadingCentros.value = true;
  try {
    const response = await fetch('http://localhost:3001/api/centros');
    if (response.ok) {
      const data = await response.json();
      // Preparem les dades per al buscador combinant nom i codi
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
    // Lògica intel·ligent:
    // Si selectedItem és un objecte (l'usuari ha clicat un centre), enviem .email
    // Si selectedItem és un string (l'usuari ha escrit manualment), enviem l'string
    let emailToSend = '';
    
    if (typeof selectedItem.value === 'object' && selectedItem.value !== null) {
      emailToSend = selectedItem.value.email;
    } else {
      emailToSend = selectedItem.value;
    }

    // Convertim a minúscules i netegem espais per si de cas
    emit('submitted', emailToSend.trim().toLowerCase());
  }
};
</script>