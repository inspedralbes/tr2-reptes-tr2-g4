<template>
  <v-container>
    <div class="d-flex align-center mb-4">
      <v-btn icon="mdi-arrow-left" variant="text" @click="$router.back()" class="mr-2"></v-btn>
      <div>
        <h1 class="text-h4">Anàlisi IA del Document</h1>
        <p class="text-subtitle-1 text-grey-darken-1">{{ filename }}</p>
        <v-chip size="small" :color="currentRole === 'docent' ? 'indigo' : 'teal'" class="mt-1">
          <v-icon start size="small">{{ currentRole === 'docent' ? 'mdi-school' : 'mdi-compass-outline' }}</v-icon>
          Perfil: {{ currentRole.toUpperCase() }}
        </v-chip>
      </div>
      <v-spacer></v-spacer>
      <!-- Botón para regenerar con IA -->
      <v-btn 
        prepend-icon="mdi-robot" 
        color="primary" 
        variant="tonal" 
        @click="regenerarResumenIA"
      >
        Regenerar Resum
      </v-btn>
    </div>

    <!-- Estat de Càrrega -->
    <div v-if="loading || loadingAI" class="d-flex flex-column justify-center align-center pa-10 text-center">
      <v-progress-circular indeterminate color="teal" size="64"></v-progress-circular>
      <span class="mt-4 text-h6 text-teal text-center">{{ currentStatus }}</span>
      
      <!-- SIMPLE TIMER INDICATOR -->
      <div v-if="loadingAI" class="mt-2 text-caption text-grey">
        La IA està treballant en el teu document.
      </div>
    </div>

    <!-- Resultat de la IA -->
    <div v-else-if="resumenIA">
      <PiSummary :analysis="parsedAnalysis" :role="currentRole" />
    </div>

    <!-- Error específic de la IA -->
    <v-alert v-else-if="errorAI" type="warning" variant="tonal" class="mt-4" border="start" border-color="warning">
      <div class="d-flex align-center">
        <v-icon icon="mdi-alert-outline" class="mr-2" color="warning"></v-icon>
        <div><strong>Error generant el resum:</strong> {{ errorAI }}</div>
      </div>
      <v-btn class="mt-2 ml-8" variant="outlined" size="small" color="warning" @click="regenerarResumenIA">Tornar a provar</v-btn>
    </v-alert>

    <!-- Error: Fitxer no trobat -->
    <v-alert v-else-if="fileNotFound" type="warning" variant="tonal" class="mt-4" border="start" border-color="warning">
      <div class="d-flex align-center">
        <v-icon icon="mdi-file-remove-outline" class="mr-2" color="warning"></v-icon>
        <div><strong>Document no disponible:</strong> El fitxer PDF no s'ha trobat al servidor.</div>
      </div>
      <div class="ml-8 mt-1 text-caption text-grey-darken-1">
        Això passa si el servidor s'ha reiniciat i no s'han guardat els fitxers, o si l'enllaç és antic.
      </div>
      <v-btn class="mt-3 ml-8" variant="outlined" size="small" color="warning" to="/">
        Tornar a la llista d'alumnes
      </v-btn>
    </v-alert>

    <!-- Error -->
    <v-alert v-else type="error" variant="tonal" class="mt-4">
      <div class="d-flex align-center">
        <v-icon icon="mdi-alert-circle-outline" class="mr-2"></v-icon>
        <div>No s'ha pogut analitzar el document. Potser el servidor s'està reiniciant.</div>
      </div>
      <v-btn class="mt-2 ml-8" variant="outlined" size="small" @click="analyzeDocument">Tornar a provar</v-btn>
    </v-alert>
  </v-container>
</template>

<script setup>
import { ref, onMounted, computed, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import PiSummary from '@/components/PiSummary.vue';

const route = useRoute();
const filename = route.params.filename;
const currentRole = computed(() => route.query.role || 'docent');

const loading = ref(true);
const loadingAI = ref(false);
const rawText = ref('');
const resumenIA = ref('');
const errorAI = ref(null);
const fileNotFound = ref(false);
const progress = ref(0);
const startTime = ref(null); // Timer
const currentStatus = ref('Iniciant...');
const modelIndex = ref(0);
let pollingInterval = null;

const parsedAnalysis = computed(() => {
  const val = resumenIA.value;

  // 1. JSON FORMAT
  if (typeof val === 'object' && val !== null) {
      return {
          perfil: [
            `Nom: ${val.dadesAlumne?.nomCognoms || '-'}`,
            `Data: ${val.dadesAlumne?.dataNaixement || '-'}`,
            `Curs: ${val.dadesAlumne?.curs || '-'}`
          ],
          dificultats: val.motiu?.diagnostic ? [val.motiu.diagnostic] : [],
          justificacio: [],
          adaptacions: val.adaptacionsGenerals || [],
          avaluacio: [],
          recomanacions: val.orientacions || []
      };
  }

  // 2. TEXT FORMAT
  const text = val || '';
  const result = {
    perfil: [], dificultats: [], justificacio: [],
    adaptacions: [], avaluacio: [], recomanacions: []
  };

  const markers = [
    { key: 'perfil', regex: /(?:^|[\.\n])\s*(?:[\*#]*\s*\d?\.?\s*)?(?:PERFIL DE L'ALUMNE|DADES PERSONALS)/i },
    { key: 'dificultats', regex: /(?:^|[\.\n])\s*(?:[\*#]*\s*\d?\.?\s*)?(?:DIAGNÒSTIC|DIFICULTATS)/i },
    { key: 'justificacio', regex: /(?:^|[\.\n])\s*(?:[\*#]*\s*\d?\.?\s*)?(?:JUSTIFICACIÓ DEL PI|JUSTIFICACIÓ)/i },
    { key: 'recomanacions', regex: /(?:^|[\.\n])\s*(?:[\*#]*\s*\d?\.?\s*)?(?:ORIENTACIÓ A L'AULA|ORIENTACIONS)/i },
    { key: 'adaptacions', regex: /(?:^|[\.\n])\s*(?:[\*#]*\s*\d?\.?\s*)?(?:ASSIGNATURES|MATÈRIES|ADAPTACIONS)/i },
    { key: 'avaluacio', regex: /(?:^|[\.\n])\s*(?:[\*#]*\s*\d?\.?\s*)?(?:CRITERIS D'AVALUACIÓ|AVALUACIÓ)/i }
  ];

  const positions = markers.map(m => {
    const match = text.match(m.regex);
    return match ? { key: m.key, index: match.index, labelLength: match[0].length } : null;
  }).filter(p => p !== null).sort((a, b) => a.index - b.index);

  if (positions.length === 0 && text.trim().length > 0) {
    result.perfil = text.split('\n').filter(l => l.trim().length > 0);
    return result;
  }

  for (let i = 0; i < positions.length; i++) {
    const current = positions[i];
    const next = positions[i + 1];
    const start = current.index + current.labelLength;
    const end = next ? next.index : text.length;
    const sectionText = text.substring(start, end).trim();
    
    const processedText = sectionText
      .replace(/([a-z0-9à-ú])\.([A-Z\*])/g, '$1.\n$2')
      .replace(/([a-z0-9à-ú])\.\s+([A-Z\*])/g, '$1.\n$2');

    result[current.key] = processedText.split('\n').filter(l => l.trim().length > 0);
  }
  return result;
});

const analyzeDocument = async () => {
  if (!filename) return;
  loading.value = true;
  try {
    const response = await fetch(`http://localhost:4002/api/analyze/${encodeURIComponent(filename)}?_t=${Date.now()}`);
    if (response.ok) {
      const data = await response.json();
      rawText.value = data.text_completo;
      checkStatus(); 
    } else {
      if (response.status === 404) fileNotFound.value = true;
      console.error("Error del servidor:", response.status);
    }
  } catch (error) {
    console.error("Error de connexió:", error);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  analyzeDocument();
});

onUnmounted(() => {
  if (pollingInterval) clearInterval(pollingInterval);
});

const checkStatus = async () => {
  try {
    const response = await fetch(`http://localhost:4002/api/students?_t=${Date.now()}`);
    const students = await response.json();
    const student = students.find(s => s.filename === filename || (s.files && s.files.some(f => f.filename === filename)));
    
    if (student) console.log("🔍 [Frontend] Estat rebut:", student.ia_data);

    if (student && student.ia_data) {
      const estado = student.ia_data.estado;
      
      if (estado === 'COMPLETAT' && student.ia_data.resumen) {
        
        // Error handling from Object
        if (student.ia_data.resumen.error) {
            console.error("❌ Error retornat pel Worker:", student.ia_data.resumen.error);
            loadingAI.value = false;
            errorAI.value = student.ia_data.resumen.error + (student.ia_data.resumen.raw ? ` (${student.ia_data.resumen.raw})` : '');
            if (pollingInterval) clearInterval(pollingInterval);
            return;
        }

        resumenIA.value = student.ia_data.resumen;
        
        // Auto-regenerate if role changed
        if (student.ia_data.role && student.ia_data.role !== currentRole.value) {
            console.log(`🔄 Rol diferent detectat. Regenerant...`);
            regenerarResumenIA();
            return;
        }

        loadingAI.value = false;
        currentStatus.value = "Completat";
        if (pollingInterval) clearInterval(pollingInterval);

      } else if (estado === 'INTERROMPUT' || estado === 'ERROR') {
        loadingAI.value = false;
        errorAI.value = student.ia_data.resumen || "Procés interromput.";
        if (pollingInterval) clearInterval(pollingInterval);
      } else if (['GENERANT...', 'A LA CUA', 'LLEGINT...'].includes(estado)) {
        loadingAI.value = true;
        
        // TIMER LOGIC
        if (!startTime.value) startTime.value = Date.now();
        const elapsed = Math.floor((Date.now() - startTime.value) / 1000);
        const elapsedStr = elapsed < 60 ? `${elapsed}s` : `${Math.floor(elapsed/60)}m ${elapsed%60}s`;

        if (student.ia_data.resumen) {
          resumenIA.value = student.ia_data.resumen;
          currentStatus.value = `Processant... (Temps: ${elapsedStr})`;
        } else {
          if (estado === 'A LA CUA') {
             currentStatus.value = `En cua d'espera... (Temps: ${elapsedStr})`;
          }
          else if (estado === 'LLEGINT...') {
             currentStatus.value = `Llegint document... (Temps: ${elapsedStr})`;
          }
          else {
             currentStatus.value = `Generant resum... (Temps: ${elapsedStr})`;
          }
        }
        
        if (!pollingInterval) {
          pollingInterval = setInterval(checkStatus, 2000);
        }
      } else {
        if (!loadingAI.value && !resumenIA.value) regenerarResumenIA();
      }
    }
  } catch (e) {
    console.error("Error comprovant estat:", e);
  }
};

const regenerarResumenIA = async () => {
  if (!rawText.value) return;
  
  modelIndex.value++;
  loadingAI.value = true;
  resumenIA.value = '';
  errorAI.value = null;
  progress.value = 0;
  startTime.value = null; // Reset timer
  currentStatus.value = 'Enviant document a la cua de processament...';
  
  try {
    const response = await fetch('http://localhost:4002/api/generate-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        text: rawText.value, 
        filename: filename, 
        role: currentRole.value
      })
    });

    if (!response.ok) throw new Error("Error enviant a la cua");
    checkStatus();

  } catch (e) {
    console.error(e);
    errorAI.value = e.message || "Error connectant amb el servidor.";
    loadingAI.value = false;
  }
};
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