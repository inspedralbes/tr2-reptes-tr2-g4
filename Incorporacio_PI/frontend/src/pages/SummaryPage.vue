<template>
  <v-container>
    <div class="d-flex align-center mb-4">
      <v-btn icon="mdi-arrow-left" variant="text" @click="$router.back()" class="mr-2"></v-btn>
      <div>
        <h1 class="text-h4">Anàlisi IA del Document</h1>
        <p class="text-subtitle-1 text-grey-darken-1">{{ filename }}</p>
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
    <!-- Modificat: Només mostrem el spinner gran si NO tenim text encara -->
    <div v-if="loading || (loadingAI && !resumenIA)" class="d-flex flex-column justify-center align-center pa-10 text-center">
      <v-progress-circular indeterminate color="teal" size="64"></v-progress-circular>
      <span class="mt-4 text-h6 text-teal text-center">{{ currentStatus }}</span>
      <div class="mt-4" style="width: 100%; max-width: 300px">
        <v-progress-linear v-model="progress" color="teal" height="25" rounded striped>
          <template v-slot:default="{ value }">
            <strong>{{ Math.ceil(value) }}% completat</strong>
          </template>
        </v-progress-linear>
      </div>
      <div class="mt-2 text-caption text-grey">
        Pots sortir d'aquesta pàgina, el procés continuarà en segon pla.
      </div>
    </div>

    <!-- Resultat de la IA -->
    <!-- CANVI: Ara fem servir un contenidor transparent en lloc d'una card única -->
    <div v-else-if="resumenIA">
      <!-- Barra de progrés dinàmica mentre s'escriu -->
      <div v-if="loadingAI" class="mb-4">
        <v-card class="pa-4 mb-4" border>
        <div class="d-flex justify-space-between text-body-2 text-primary mb-1">
          <span class="d-flex align-center">
            <v-icon icon="mdi-pencil" size="small" class="mr-2 start-animation"></v-icon>
            {{ currentStatus }}
          </span>
          <span class="text-caption text-grey">{{ wordCount }} paraules generades</span>
        </div>
        <!-- BARRA DE PROGRÉS HONESTA (Indeterminada mentre genera) -->
        <v-progress-linear 
          indeterminate
          color="primary" 
          height="6" 
          rounded 
          striped
        ></v-progress-linear>
        </v-card>
      </div>

      <!-- COMPONENT VISUAL (Restaurat) -->
      <PiSummary :analysis="parsedAnalysis" />
      
      <!-- Debug (opcional, per si vols veure el text cru mentre es genera) -->
      <!-- <div class="text-caption text-grey mt-4">Text cru: {{ resumenIA.length }} caràcters</div> -->
    </div>

    <!-- Error específic de la IA -->
    <v-alert v-else-if="errorAI" type="warning" variant="tonal" class="mt-4" border="start" border-color="warning">
      <div class="d-flex align-center">
        <v-icon icon="mdi-alert-outline" class="mr-2" color="warning"></v-icon>
        <div><strong>Error generant el resum:</strong> {{ errorAI }}</div>
      </div>
      <v-btn class="mt-2 ml-8" variant="outlined" size="small" color="warning" @click="regenerarResumenIA">Tornar a provar</v-btn>
    </v-alert>

    <!-- Error: Fitxer no trobat (NOU) -->
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
      No s'ha pogut analitzar el document. Potser és una imatge o està protegit.
    </v-alert>
  </v-container>
</template>

<script setup>
import { ref, onMounted, computed, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import PiSummary from '@/components/PiSummary.vue';

const route = useRoute();
const filename = route.params.filename;

const loading = ref(true);
const loadingAI = ref(false);
const rawText = ref('');
const resumenIA = ref('');
const errorAI = ref(null);
const fileNotFound = ref(false);
const progress = ref(0);
const currentStatus = ref('Iniciant...');
const modelIndex = ref(0); // Per rotar models
let pollingInterval = null; // Variable per guardar l'interval de comprovació

const wordCount = computed(() => {
  return resumenIA.value ? resumenIA.value.trim().split(/\s+/).filter(w => w.length > 0).length : 0;
});

// --- NOVA FUNCIÓ: Parsejar el text de la IA a l'estructura de PiSummary ---
const parsedAnalysis = computed(() => {
  const text = resumenIA.value || '';
  const result = {
    perfil: [],
    dificultats: [],
    adaptacions: [],
    avaluacio: [],
    recomanacions: []
  };

  // Definim els marcadors amb REGEX per detectar les seccions que genera la IA
  const markers = [
    { key: 'perfil', regex: /(?:^|\n)\s*(?:[\*#]*\s*1\.\s*)?(?:PERFIL DE L'ALUMNE|PERFIL|Dades de l['’]alumne|Diagnòstic).*/i },
    { key: 'dificultats', regex: /(?:^|\n)\s*(?:[\*#]*\s*2\.\s*)?(?:DIFICULTATS I BARRERES|Dificultats Principals|DIFICULTATS|Motiu del pla|Motiu del PI|Punts febles|Observacions|Habilitats).*/i },
    { key: 'adaptacions', regex: /(?:^|\n)\s*(?:[\*#]*\s*3\.\s*)?(?:ADAPTACIONS METODOLÒGIQUES|ADAPTACIONS|Mesures|Estratègies|Adaptacions curriculars).*/i },
    { key: 'avaluacio', regex: /(?:^|\n)\s*(?:[\*#]*\s*4\.\s*)?(?:AVALUACIÓ I QUALIFICACIÓ|AVALUACIÓ|Qualificació|Criteris d'Avaluació|Criteris).*/i },
    { key: 'recomanacions', regex: /(?:^|\n)\s*(?:[\*#]*\s*5\.\s*)?(?:RECOMANACIONS I TRASPÀS|RECOMANACIONS|Orientacions|Consells).*/i }
  ];

  // Busquem on comença cada secció
  const positions = markers.map(m => {
    const match = text.match(m.regex);
    return match ? { key: m.key, index: match.index, labelLength: match[0].length } : null;
  }).filter(p => p !== null).sort((a, b) => a.index - b.index);

  // Si no troba cap secció, ho posem tot a perfil (fallback)
  if (positions.length === 0 && text.trim().length > 0) {
    result.perfil = text.split('\n').filter(l => l.trim().length > 0);
    return result;
  }

  // Tallem el text per seccions
  for (let i = 0; i < positions.length; i++) {
    const current = positions[i];
    const next = positions[i + 1];
    const start = current.index + current.labelLength;
    const end = next ? next.index : text.length;
    const sectionText = text.substring(start, end).trim();
    
    result[current.key] = sectionText.split('\n').filter(l => l.trim().length > 0);
  }

  return result;
});

onMounted(async () => {
  if (!filename) return;

  try {
    // 1. Obtenim el text del PDF des del backend
    const response = await fetch(`http://localhost:3001/api/analyze/${encodeURIComponent(filename)}`);
    
    if (response.ok) {
      const data = await response.json();
      rawText.value = data.text_completo;
      
      // 2. Comprovem si JA tenim un resum guardat a la BD (per no regenerar si no cal)
      // Necessitem una ruta per obtenir l'estat actual de l'alumne.
      // Com que no tenim ruta específica, fem servir la llista d'alumnes o una crida nova.
      // Per simplificar, assumim que si entrem aquí volem veure l'estat.
      
      // Truc: Fem servir la ruta de fitxers o creem una funció de checkStatus
      checkStatus(); 

    } else {
      if (response.status === 404) {
        fileNotFound.value = true;
      }
      console.error("Error del servidor:", response.status);
    }
  } catch (error) {
    console.error("Error de connexió:", error);
  } finally {
    loading.value = false;
  }
});

onUnmounted(() => {
  if (pollingInterval) clearInterval(pollingInterval);
});

const checkStatus = async () => {
  try {
    // Obtenim la llista d'estudiants per buscar el nostre (no és el més eficient però funciona amb el backend actual)
    const response = await fetch('http://localhost:3001/api/students');
    const students = await response.json();
    // Busquem l'alumne que tingui aquest fitxer
    const student = students.find(s => s.filename === filename || (s.files && s.files.some(f => f.filename === filename)));
    
    if (student) console.log("🔍 [Frontend] Estat rebut:", student.ia_data);

    if (student && student.ia_data) {
      const estado = student.ia_data.estado;
      
      if (estado === 'COMPLETAT' && student.ia_data.resumen) {
        resumenIA.value = student.ia_data.resumen;
        loadingAI.value = false;
        currentStatus.value = "Completat";
        if (pollingInterval) clearInterval(pollingInterval);
      } else if (estado === 'INTERROMPUT') {
        loadingAI.value = false;
        errorAI.value = student.ia_data.resumen || "Procés interromput.";
        if (pollingInterval) clearInterval(pollingInterval);
      } else if (['GENERANT...', 'A LA CUA', 'LLEGINT...'].includes(estado)) {
        loadingAI.value = true;
        
        // ACTUALITZACIÓ EN TEMPS REAL
        // Si tenim progrés a la BD, l'utilitzem. Si no, estimem.
        const dbProgress = student.ia_data.progress || 0;

        // Ara el backend calcula el progrés real (lectura + escriptura), així que confiem en ell
        progress.value = estado === 'A LA CUA' ? 0 : dbProgress;

        // Si ja tenim text parcial, el mostrem (efecte streaming)
        if (student.ia_data.resumen) {
          resumenIA.value = student.ia_data.resumen;
          currentStatus.value = `Generant resum... (${Math.ceil(progress.value)}%)`;
        } else {
          if (estado === 'A LA CUA') currentStatus.value = 'En cua d\'espera...';
          else if (estado === 'LLEGINT...') currentStatus.value = 'Llegint i processant document (això pot trigar)...';
          else currentStatus.value = 'Iniciant generació...';
        }
        
        // Si no estem fent polling, comencem
        if (!pollingInterval) {
          pollingInterval = setInterval(checkStatus, 3000); // Comprovar cada 3 segons
        }
      } else {
        // Si no hi ha estat, potser és la primera vegada
        if (!loadingAI.value && !resumenIA.value) regenerarResumenIA();
      }
    }
  } catch (e) {
    console.error("Error comprovant estat:", e);
  }
};

const regenerarResumenIA = async () => {
  if (!rawText.value) return;
  
  // Rotació de model: Sempre provem el següent de la llista
  modelIndex.value++;

  loadingAI.value = true;
  resumenIA.value = ''; // Netegem el resum anterior
  errorAI.value = null; // Netegem errors anteriors
  progress.value = 0;
  currentStatus.value = 'Enviant document a la cua de processament...';
  
  try {
    const response = await fetch('http://localhost:3001/api/generate-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        text: rawText.value, 
        filename: filename // Important per saber a qui actualitzar
      })
    });

    if (!response.ok) throw new Error("Error enviant a la cua");

    // Si tot va bé, iniciem el polling
    checkStatus();

  } catch (e) {
    console.error(e);
    // Mostramos el mensaje del error
    errorAI.value = e.message || "Error connectant amb el servidor.";
    loadingAI.value = false;
  } finally {
    // No posem loadingAI = false aquí perquè volem que segueixi carregant mentre fa polling
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