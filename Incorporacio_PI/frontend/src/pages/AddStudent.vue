<template>
  <v-container class="fill-height d-flex align-center justify-center bg-grey-lighten-5">
    <v-card width="100%" max-width="500" elevation="4" class="pa-4 rounded-xl">
      
      <v-card-title class="text-h5 font-weight-bold text-primary d-flex align-center">
        <v-icon start icon="mdi-account-plus" color="green-darken-2"></v-icon>
        Registrar Nou Alumne
      </v-card-title>
      
      <v-card-subtitle class="mt-1">
        Introdueix les dades bàsiques. El sistema generarà el codi automàticament.
      </v-card-subtitle>

      <v-card-text class="mt-4">
        <v-form ref="form" v-model="valid" @submit.prevent="submitForm">
          
          <v-text-field
            v-model="student.nombre"
            label="Nom i Cognoms"
            prepend-inner-icon="mdi-account"
            variant="outlined"
            :rules="nameRules"
            required
            class="mb-2"
          ></v-text-field>

          <v-text-field
            v-model="student.id"
            label="ID Alumne: RALC"
            prepend-inner-icon="mdi-identifier"
            variant="outlined"
            hint="Aquest ID serà la referència única."
            persistent-hint
            :rules="idRules"
            required
          ></v-text-field>

          <v-alert
            v-if="errorMessage"
            type="error"
            variant="tonal"
            density="compact"
            class="mt-4"
            closable
          >
            {{ errorMessage }}
          </v-alert>

        </v-form>
      </v-card-text>

      <v-card-actions class="justify-space-between pt-2 px-4">
        <v-btn variant="text" color="grey-darken-1" @click="$router.back()">
          Cancel·lar
        </v-btn>
        
        <v-btn 
          color="green-darken-1" 
          variant="elevated" 
          :loading="loading"
          :disabled="!valid"
          @click="submitForm"
        >
          Guardar Alumne
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-container>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const valid = ref(false);
const loading = ref(false);
const errorMessage = ref('');

const student = reactive({
  nombre: '',
  id: ''
});

const nameRules = [v => !!v || 'El nom és obligatori'];
const idRules = [v => !!v || "L'ID és obligatori"];

const submitForm = async () => {
  if (!valid.value) return;
  
  loading.value = true;
  errorMessage.value = '';

  try {
    const response = await fetch('http://localhost:4002/api/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(student)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Error desconegut');
    }

    // Èxit: Redirigim a la llista d'alumnes
    router.push('/alumnos'); 

  } catch (error) {
    errorMessage.value = error.message;
  } finally {
    loading.value = false;
  }
};
</script>