<template>
  <v-card class="pa-6" elevation="4" max-width="500" rounded="lg">
    <div class="text-center mb-4">
      <v-icon icon="mdi-school" size="64" color="primary"></v-icon>
      <v-card-title class="text-h5 font-weight-bold">Accés Centres</v-card-title>
      <v-card-subtitle>Busca el teu centre o introdueix el correu</v-card-subtitle>
    </div>

    <v-form ref="form" @submit.prevent="submit">
      <v-card-text>
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
          <template v-slot:item="{ props, item }">
            <v-list-item v-bind="props" :subtitle="item.raw.email">
              <template v-slot:prepend>
                <v-icon icon="mdi-domain" color="grey"></v-icon>
              </template>
            </v-list-item>
          </template>

          <template v-slot:no-data>
            <v-list-item>
              <v-list-item-title>
                Cap centre trobat. <br>
                <small class="text-grey">Pots escriure el teu email manualment i prémer Enter.</small>
              </v-list-item-title>
            </v-list-item>
          </template>
        </v-combobox>

        <!-- Component del Captcha -->
        <div class="d-flex justify-center mt-6">
            <VueRecaptcha
                :sitekey="siteKey"
                @verify="onCaptchaVerify"
                @expired="onCaptchaExpired"
            ></VueRecaptcha>
        </div>
        
        <div v-if="captchaError" class="text-center text-caption text-red mt-2">
            Per seguretat, confirma que no ets un robot.
        </div>

      </v-card-text>

      <v-card-actions class="mt-2">
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
import { ref, onMounted } from 'vue';
import VueRecaptcha from 'vue3-recaptcha2';

const props = defineProps({
  loading: Boolean
});

const emit = defineEmits(['submitted']);

const form = ref(null);
const centros = ref([]);
const loadingCentros = ref(false);
const selectedItem = ref(null);

// CORRECCIÓ 2: He posat la teva CLAU PÚBLICA (Site Key)
// La que tenies posada era la secreta (la secreta només va al backend)
const siteKey = "6LcLBUgsAAAAAO5gfUHPVfkHogRC-gaLtrDb7YrH";

const recaptchaToken = ref(null);
const captchaError = ref(false);

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
    const response = await fetch('http://localhost:3001/api/centros');
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

const onCaptchaVerify = (token) => {
    recaptchaToken.value = token;
    captchaError.value = false;
};

const onCaptchaExpired = () => {
    recaptchaToken.value = null;
};

const submit = async () => {
  const { valid } = await form.value.validate();
  
  if (!recaptchaToken.value) {
      captchaError.value = true;
      return; 
  }

  if (valid) {
    let emailToSend = '';
    if (typeof selectedItem.value === 'object' && selectedItem.value !== null) {
      emailToSend = selectedItem.value.email;
    } else {
      emailToSend = selectedItem.value;
    }

    emit('submitted', { 
        email: emailToSend.trim().toLowerCase(),
        token: recaptchaToken.value 
    });
  }
};
</script>