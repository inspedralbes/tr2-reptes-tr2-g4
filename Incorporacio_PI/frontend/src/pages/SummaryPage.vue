<template>
  <v-container>
    <div class="d-flex align-center mb-4">
      <v-btn icon="mdi-arrow-left" variant="text" @click="$router.back()" class="mr-2"></v-btn>
      <div>
        <h1 class="text-h4">Anàlisi IA del Document</h1>
        <p class="text-subtitle-1 text-grey-darken-1">{{ filename }}</p>
      </div>
      <v-spacer></v-spacer>
      <!-- Botón para regenerar con IA Local -->
      <v-btn 
        prepend-icon="mdi-robot" 
        color="primary" 
        variant="tonal" 
        :loading="loadingAI"
        @click="regenerarResumenLocal"
      >
        Regenerar Resum
      </v-btn>
    </div>

    <!-- Estat de Càrrega -->
    <!-- Modificat: Només mostrem el spinner gran si NO tenim text encara -->
    <div v-if="loading || (loadingAI && !resumenIA)" class="d-flex flex-column justify-center align-center pa-10">
      <v-progress-circular indeterminate color="teal" size="64"></v-progress-circular>
      <span class="mt-4 text-h6 text-teal text-center">{{ currentStatus }}</span>
      <div class="mt-4" style="width: 100%; max-width: 300px">
        <v-progress-linear v-model="progress" color="teal" height="25" rounded striped>
          <template v-slot:default="{ value }">
            <strong>{{ Math.ceil(value) }}% completat</strong>
          </template>
        </v-progress-linear>
      </div>
    </div>

    <!-- Resultat de la IA -->
    <v-card v-else-if="resumenIA" class="pa-6" elevation="2">
      <!-- Barra de progrés dinàmica mentre s'escriu -->
      <div v-if="loadingAI" class="mb-4">
        <div class="d-flex justify-space-between text-body-2 text-primary mb-1">
          <span class="d-flex align-center">
            <v-icon icon="mdi-pencil" size="small" class="mr-2 start-animation"></v-icon>
            {{ currentStatus }}
          </span>
          <span class="text-caption text-grey">{{ wordCount }} paraules generades</span>
        </div>
        <v-progress-linear v-model="progress" color="primary" height="6" rounded striped></v-progress-linear>
        <div class="text-right mt-1">
          <span class="text-body-2 font-weight-bold text-primary">{{ Math.ceil(progress) }}% completed</span>
        </div>
      </div>

      <div class="text-body-1" style="white-space: pre-wrap;">{{ resumenIA }}</div>
    </v-card>

    <!-- Error -->
    <v-alert v-else type="error" variant="tonal" class="mt-4">
      No s'ha pogut analitzar el document. Potser és una imatge o està protegit.
    </v-alert>
  </v-container>
</template>

<script setup>
import { ref, onMounted, computed, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { resumirTextoPI } from './aiService'; // Importamos tu servicio local

const route = useRoute();
const filename = route.params.filename;

const loading = ref(true);
const loadingAI = ref(false);
const rawText = ref('');
const resumenIA = ref('');
const progress = ref(0);
const currentStatus = ref('Iniciant...');

let progressInterval = null; // Variable per controlar el timer de la barra

const wordCount = computed(() => {
  return resumenIA.value ? resumenIA.value.trim().split(/\s+/).filter(w => w.length > 0).length : 0;
});

onMounted(async () => {
  if (!filename) return;

  try {
    // 1. Obtenim el text del PDF des del backend
    const response = await fetch(`http://localhost:3001/api/analyze/${encodeURIComponent(filename)}`);
    
    if (response.ok) {
      const data = await response.json();
      rawText.value = data.text_completo;
      
      // 2. Un cop tenim el text, cridem automàticament a Ollama
      await regenerarResumenLocal();
    } else {
      console.error("Error del servidor:", response.status);
    }
  } catch (error) {
    console.error("Error de connexió:", error);
  } finally {
    loading.value = false;
  }
});

const regenerarResumenLocal = async () => {
  if (!rawText.value) return;
  
  loadingAI.value = true;
  resumenIA.value = ''; // Netegem el resum anterior
  progress.value = 0;
  currentStatus.value = 'Starting AI engine...';
  
  // Netejem interval previ si n'hi ha
  if (progressInterval) clearInterval(progressInterval);

  // --- SISTEMA DE PROGRÉS HÍBRID ---
  // Timer: Fa que la barra pugi suaument encara que la IA estigui "pensant" i no escrigui res.
  progressInterval = setInterval(() => {
    // Pugem a poc a poc fins al 95% mentre pensem
    if (progress.value < 95) {
       progress.value += (95 - progress.value) * 0.05; // Desacceleració suau
    } 
  }, 250); // Actualització cada 250ms

  try {
    // Estimació: Tenim en compte que l'aiService retalla a 12000 caràcters
    const MAX_CHARS_AI = 12000;
    const textLength = Math.min(rawText.value.length, MAX_CHARS_AI);
    // AJUSTAT: Un resum sol ser el 10% del text (abans 20%), així la barra puja més ràpid
    const estimatedLength = Math.max(100, textLength * 0.10);

    // Enviem el text net a Ollama amb un callback per actualitzar en temps real
    await resumirTextoPI(rawText.value, (textParcial) => {
      resumenIA.value = textParcial;
      
      // Lògica de progrés basada en text generat
      const calculatedProgress = Math.min(99, (textParcial.length / estimatedLength) * 100);

      // Només actualitzem si el càlcul real (text) és superior al del timer (per no tirar enrere)
      if (calculatedProgress > progress.value) {
        progress.value = calculatedProgress;
      }
    }, (statusUpdate) => {
      // Callback d'estat
      currentStatus.value = statusUpdate;
    });
    progress.value = 100;
  } catch (e) {
    console.error(e);
    // Mostramos el mensaje exacto del error (ej: "Ejecuta docker exec...")
    resumenIA.value = e.message || "Error connectant amb la IA local. Assegura't que Docker/Ollama està funcionant.";
  } finally {
    loadingAI.value = false;
    if (progressInterval) clearInterval(progressInterval);
  }
};

// Neteja quan sortim de la pàgina
onUnmounted(() => {
  if (progressInterval) clearInterval(progressInterval);
});
</script>

<style scoped>
.start-animation {
  animation: pulse 1.5s infinite;
}
@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
}
</style>