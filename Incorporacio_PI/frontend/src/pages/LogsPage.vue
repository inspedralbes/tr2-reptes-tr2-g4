<template>
  <v-container>
    <div class="d-flex align-center mb-4">
      <v-btn icon="mdi-arrow-left" variant="text" @click="$router.back()" class="mr-2"></v-btn>
      <h1 class="text-h4">Registre d'Activitat</h1>
    </div>

    <v-card elevation="2">
      <v-table>
        <thead>
          <tr>
            <th class="text-left">Data</th>
            <th class="text-left">Usuari</th>
            <th class="text-left">Acció</th>
            <th class="text-left">Alumne (RALC)</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="log in logs" :key="log._id">
            <td>{{ new Date(log.timestamp).toLocaleString() }}</td>
            <td>{{ log.usuari }}</td>
            <td>
              <v-chip 
                size="small" 
                :color="getActionColor(log.accio)" 
                variant="outlined" 
                class="font-weight-bold"
              >
                {{ log.accio }}
              </v-chip>
            </td>
            <td>{{ log.ralc_alumne }}</td>
          </tr>
          <tr v-if="logs.length === 0 && !loading">
            <td colspan="4" class="text-center pa-4 text-grey">No hi ha registres disponibles.</td>
          </tr>
        </tbody>
      </v-table>
      
      <div v-if="loading" class="d-flex justify-center pa-4">
        <v-progress-circular indeterminate color="primary"></v-progress-circular>
      </div>
    </v-card>
  </v-container>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const logs = ref([]);
const loading = ref(true);

onMounted(async () => {
  try {
    const response = await fetch('http://localhost:4002/api/students');
    if (response.ok) {
      logs.value = await response.json();
    } else {
      console.error("Error carregant logs");
    }
  } catch (error) {
    console.error("Error de xarxa:", error);
  } finally {
    loading.value = false;
  }
});

const getActionColor = (accio) => {
  if (!accio) return 'primary';
  const text = accio.toLowerCase();

  // VERMELL: Eliminacions
  if (text.includes('eliminació') || text.includes('delete')) {
    return 'error'; 
  }
  
  // VERD: Login, Sessió, Codi
  if (text.includes('sessió') || text.includes('codi') || text.includes('login')) {
    return 'success'; 
  }

  // BLAU: Per defecte (Pujades)
  return 'primary'; 
};
</script>