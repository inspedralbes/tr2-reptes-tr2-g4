<template>
  <v-container>
    <div class="d-flex align-center mb-4">
      <v-btn icon="mdi-arrow-left" variant="text" @click="$router.back()" class="mr-2"></v-btn>
      <div>
        <h1 class="text-h4">Anàlisi IA del Document</h1>
        <p class="text-subtitle-1 text-grey-darken-1">{{ filename }}</p>
      </div>
    </div>

    <!-- Estat de Càrrega -->
    <div v-if="loading" class="d-flex flex-column justify-center align-center pa-10">
      <v-progress-circular indeterminate color="purple" size="64"></v-progress-circular>
      <span class="mt-4 text-h6 text-purple">La IA està llegint el document...</span>
    </div>

    <!-- Component de Resum (Reutilitzat) -->
    <PiSummary v-else-if="summaryData" :analysis="summaryData" />

    <!-- Error -->
    <v-alert v-else type="error" variant="tonal" class="mt-4">
      No s'ha pogut analitzar el document. Potser és una imatge o està protegit.
    </v-alert>
  </v-container>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import PiSummary from '@/components/PiSummary.vue';

const route = useRoute();
const filename = route.params.filename;

const loading = ref(true);
const summaryData = ref(null);

onMounted(async () => {
  if (!filename) return;

  try {
    // Cridem al backend
    const response = await fetch(`http://localhost:3001/api/analyze/${encodeURIComponent(filename)}`);
    
    if (response.ok) {
      summaryData.value = await response.json();
    } else {
      console.error("Error del servidor:", response.status);
    }
  } catch (error) {
    console.error("Error de connexió:", error);
  } finally {
    loading.value = false;
  }
});
</script>