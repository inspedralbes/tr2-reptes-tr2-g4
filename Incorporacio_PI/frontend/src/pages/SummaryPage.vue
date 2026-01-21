<template>
  <v-container class="fill-height align-start bg-grey-lighten-5" fluid>
    <v-row justify="center">
      <v-col cols="12" lg="10" xl="8">

        <div class="d-flex align-center mb-6 mt-4">
          <v-btn variant="text" prepend-icon="mdi-arrow-left" @click="$router.back()" color="grey-darken-3"
            class="mr-4 text-none font-weight-bold pl-0">
            Tornar
          </v-btn>
          <v-divider vertical class="mr-4 border-opacity-50"></v-divider>

          <div>
            <h1 class="text-h5 font-weight-black text-grey-darken-3 gencat-font mb-1">
              Anàlisi Automàtica del Document
            </h1>
            <div
              class="d-inline-flex align-center px-2 py-1 bg-white border rounded text-caption font-weight-bold text-grey-darken-2">
              <v-icon icon="mdi-file-pdf-box" size="small" color="#D0021B" class="mr-2"></v-icon>
              {{ displayName }}
            </div>
          </div>
        </div>

        <v-card v-if="loading" class="gencat-card py-16 text-center" elevation="0" rounded="lg">
          <div class="d-flex justify-center mb-6">
            <v-progress-circular indeterminate color="purple-darken-2" size="80" width="6"></v-progress-circular>
          </div>
          <h2 class="text-h6 font-weight-bold text-grey-darken-3 mb-2">
            El sistema està processant el document...
          </h2>
          <p class="text-body-2 text-grey-darken-1" style="max-width: 500px; margin: 0 auto;">
            Això pot trigar uns segons. La Intel·ligència Artificial està extraient les dades clau,
            identificant els participants i generant un resum executiu.
          </p>
        </v-card>

        <div v-else-if="summaryData">
          <PiSummary :analysis="summaryData" />
        </div>

        <v-card v-else class="gencat-card pa-6 text-center border-red" elevation="0" rounded="lg">
          <v-icon icon="mdi-alert-circle-outline" color="#D0021B" size="64" class="mb-4"></v-icon>
          <h3 class="text-h6 font-weight-bold text-grey-darken-3 mb-2">Error d'Anàlisi</h3>
          <p class="text-body-2 text-grey-darken-1 mb-6">
            No s'ha pogut analitzar el document. Pot ser que el fitxer estigui protegit, corrupte o sigui una imatge no
            llegible.
          </p>
          <v-btn color="grey-darken-3" variant="outlined" @click="$router.back()">
            Tornar a l'expedient
          </v-btn>
        </v-card>

      </v-col>
    </v-row>
  </v-container>
</template>
<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import PiSummary from '@/components/PiSummary.vue';

const route = useRoute();
// filename: Nombre interno (hash) para buscar en la API
const filename = route.params.filename;

// displayName: Nombre bonito para mostrar al usuario (viene por ?query)
// Si no existe, usamos el filename por defecto
const displayName = computed(() => route.query.originalName || filename);

const loading = ref(true);
const summaryData = ref(null);

// 1. DEFINIMOS LA URL BASE CORRECTA
const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:3001');

onMounted(async () => {
  if (!filename) return;

  try {
    // 2. CORREGIDO: Usamos API_URL en lugar de localhost
    const response = await fetch(`${API_URL}/api/analyze/${encodeURIComponent(filename)}`);

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

<style scoped>
.gencat-font {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
}

.gencat-card {
  border: 1px solid rgba(0, 0, 0, 0.1) !important;
  background-color: white;
}

.border-red {
  border-color: #ffcdd2 !important;
  background-color: #fffafa !important;
}
</style>