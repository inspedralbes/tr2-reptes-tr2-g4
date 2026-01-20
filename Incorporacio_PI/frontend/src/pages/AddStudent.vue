<template>
  <v-container class="fill-height align-start bg-grey-lighten-5" fluid>
    <v-row justify="center">
      <v-col cols="12" sm="10" md="8" lg="6">
        
        <div class="mb-6 mt-4">
          <v-btn 
            variant="text" 
            prepend-icon="mdi-arrow-left" 
            @click="$router.back()" 
            color="grey-darken-3"
            class="text-none font-weight-bold pl-0"
          >
            Cancel·lar i tornar
          </v-btn>
        </div>

        <v-card class="gencat-card pa-8" elevation="0" rounded="lg">
          
          <div class="text-center mb-8">
            <v-avatar color="red-lighten-5" size="80" class="mb-4">
              <v-icon icon="mdi-account-plus-outline" color="#D0021B" size="40"></v-icon>
            </v-avatar>
            <h1 class="text-h5 font-weight-black text-grey-darken-3 gencat-font mb-2">
              Alta de Nou Alumne
            </h1>
            <p class="text-body-2 text-grey-darken-1">
              Completeu el formulari per registrar un nou expedient a la base de dades.
            </p>
          </div>

          <v-card-text class="pa-0">
            <v-form ref="form" v-model="valid" @submit.prevent="submitForm">
              
              <div class="mb-4">
                <v-label class="text-caption font-weight-bold text-grey-darken-2 mb-1">DADES PERSONALS</v-label>
                <v-text-field
                  v-model="student.nombre"
                  label="Nom i Cognoms de l'alumne"
                  placeholder="Ex: Joan Garcia..."
                  variant="outlined"
                  color="#D0021B"
                  base-color="grey-darken-1"
                  prepend-inner-icon="mdi-account"
                  :rules="nameRules"
                  required
                ></v-text-field>
              </div>
              
              <div class="mb-4">
                <v-label class="text-caption font-weight-bold text-grey-darken-2 mb-1">IDENTIFICACIÓ</v-label>
                <v-text-field
                  v-model="student.id"
                  label="ID Alumne (RALC)"
                  placeholder="Ex: 123456789"
                  variant="outlined"
                  color="#D0021B"
                  base-color="grey-darken-1"
                  prepend-inner-icon="mdi-identifier"
                  hint="Aquest ID serà la referència única de l'expedient."
                  persistent-hint
                  :rules="idRules"
                  required
                ></v-text-field>
              </div>

              <div class="mb-4">
                <v-label class="text-caption font-weight-bold text-grey-darken-2 mb-1">UBICACIÓ</v-label>
                <v-autocomplete
                  v-model="student.codi_centre"
                  :items="centrosList"
                  item-title="denominacio_completa"
                  item-value="codi_centre"
                  label="Centre Educatiu Assignat"
                  placeholder="Cercar centre..."
                  variant="outlined"
                  color="#D0021B"
                  base-color="grey-darken-1"
                  prepend-inner-icon="mdi-school"
                  :rules="centerRules"
                  clearable
                  required
                  no-data-text="No s'han trobat centres"
                >
                  <template v-slot:item="{ props, item }">
                    <v-list-item v-bind="props" :subtitle="`Codi: ${item.raw.codi_centre}`"></v-list-item>
                  </template>
                </v-autocomplete>
              </div>

              <div class="mb-6">
                <v-label class="text-caption font-weight-bold text-grey-darken-2 mb-1">DATA D'ALTA AL CENTRE</v-label>
                <v-text-field
                  v-model="student.start_date"
                  type="date"
                  variant="outlined"
                  color="#D0021B"
                  base-color="grey-darken-1"
                  prepend-inner-icon="mdi-calendar-start"
                  hint="Data en què l'alumne va començar a aquest centre."
                  persistent-hint
                  :rules="dateRules"
                  required
                ></v-text-field>
              </div>

              <v-alert
                v-if="errorMessage"
                type="error"
                variant="tonal"
                color="#D0021B"
                density="comfortable"
                class="mb-6 border-red"
                closable
              >
                {{ errorMessage }}
              </v-alert>

              <v-divider class="mb-6"></v-divider>

              <div class="d-flex justify-end gap-4">
                <v-btn 
                  variant="text" 
                  color="grey-darken-2" 
                  @click="$router.back()"
                  class="text-none font-weight-bold"
                >
                  Cancel·lar
                </v-btn>
                
                <v-btn 
                  color="#D0021B" 
                  variant="flat" 
                  size="large"
                  class="text-white text-none font-weight-bold gencat-btn"
                  :loading="loading"
                  :disabled="!valid"
                  @click="submitForm"
                >
                  Guardar Alumne
                </v-btn>
              </div>

            </v-form>
          </v-card-text>
        </v-card>

      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const valid = ref(false);
const loading = ref(false);
const errorMessage = ref('');

const centrosList = ref([]); 

// 1. DEFINIMOS LA URL BASE CORRECTA
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const student = reactive({
  nombre: '',
  id: '',
  codi_centre: null,
  start_date: ''
});

// Reglas de validación
const nameRules = [v => !!v || "El nom és obligatori"];
const idRules = [v => !!v || "L'ID (RALC) és obligatori"];
const centerRules = [v => !!v || 'Has de seleccionar un centre'];
const dateRules = [v => !!v || "La data d'inici és obligatòria"];

onMounted(async () => {
  student.start_date = new Date().toISOString().split('T')[0];

  try {
    // 2. CORREGIDO: Usamos API_URL
    const response = await fetch(`${API_URL}/api/centros`);
    if (response.ok) {
      centrosList.value = await response.json();
    } else {
      console.error("Error al cargar centros:", response.statusText);
      errorMessage.value = "Error carregant la llista de centres.";
    }
  } catch (error) {
    console.error("Error de conexión:", error);
    errorMessage.value = "No s'ha pogut connectar amb el servidor.";
  }
});

const submitForm = async () => {
  if (!valid.value) return;
  
  loading.value = true;
  errorMessage.value = '';

  try {
    // 3. CORREGIDO: Usamos API_URL
    const response = await fetch(`${API_URL}/api/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(student) 
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Error desconegut al crear l\'alumne');
    }

    router.push('/alumnos'); 

  } catch (error) {
    errorMessage.value = error.message;
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
/* ESTILS GENCAT */
.gencat-font {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
}

.gencat-card {
  border: 1px solid rgba(0,0,0,0.1) !important;
  background-color: white;
}

.gencat-btn {
  border-radius: 4px !important;
}

.border-red {
  border: 1px solid #ffcdd2 !important;
}
</style>