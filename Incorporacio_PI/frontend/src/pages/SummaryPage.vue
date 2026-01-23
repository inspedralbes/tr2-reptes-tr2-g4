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
    <!-- Modificat: Ara mostrem això SEMPRE que estigui carregant, amagant el text parcial -->
    <!-- Estat de Càrrega (MILLORAT per a cada procés) -->
    <div v-if="loading || loadingAI" class="d-flex flex-column justify-center align-center pa-6 text-center">
      
      <v-card variant="flat" border class="pa-6 w-100" max-width="500">
        <h2 class="text-h6 mb-6">Processant Document</h2>
        
        <!-- Pas 1: Extracció -->
        <div class="d-flex align-center mb-4">
          <v-icon :color="progress >= 5 ? 'success' : 'grey'" :icon="progress >= 5 ? 'mdi-check-circle' : 'mdi-circle-outline'" class="mr-3"></v-icon>
          <span :class="{'text-grey': progress < 5, 'font-weight-bold': progress >= 5 && progress < 10}">1. Extracció de text del document</span>
        </div>

        <!-- Pas 2: Lectura -->
        <div class="d-flex align-center mb-4">
          <v-icon 
            :color="backendStatus === 'GENERANT...' || backendStatus === 'COMPLETAT' ? 'success' : (backendStatus === 'LLEGINT...' ? 'primary' : 'grey')" 
            :icon="backendStatus === 'GENERANT...' || backendStatus === 'COMPLETAT' ? 'mdi-check-circle' : 'mdi-school'" 
            class="mr-3"
          ></v-icon>
          <div class="text-left flex-grow-1">
            <span :class="{'text-grey': backendStatus !== 'LLEGINT...', 'font-weight-bold font-italic': backendStatus === 'LLEGINT...'}">2. Lectura i comprensió (IA)</span>
            <v-progress-linear v-if="backendStatus === 'LLEGINT...'" color="primary" height="6" :model-value="((progress - 5) / 85) * 100" rounded class="mt-1" striped></v-progress-linear>
          </div>
          <span v-if="backendStatus === 'LLEGINT...'" class="ml-2 text-caption font-weight-bold text-primary">{{ Math.round(((progress - 5) / 85) * 100) }}%</span>
        </div>

        <!-- Pas 3: Generació -->
        <div class="d-flex align-center mb-6">
          <v-icon 
            :color="backendStatus === 'COMPLETAT' ? 'success' : (backendStatus === 'GENERANT...' ? 'teal' : 'grey')" 
            :icon="backendStatus === 'COMPLETAT' ? 'mdi-check-circle' : 'mdi-auto-fix'" 
            class="mr-3"
          ></v-icon>
          <div class="text-left flex-grow-1">
            <span :class="{'text-grey': backendStatus !== 'GENERANT...', 'font-weight-bold font-italic font-variant-small-caps': backendStatus === 'GENERANT...'}">3. Escriptura del resum detallat</span>
            <v-progress-linear v-if="backendStatus === 'GENERANT...'" color="teal" height="6" :model-value="((progress - 90) / 10) * 100" rounded class="mt-1" striped></v-progress-linear>
          </div>
          <span v-if="backendStatus === 'GENERANT...'" class="ml-2 text-caption font-weight-bold text-teal">{{ Math.round(((progress - 90) / 10) * 100) }}%</span>
        </div>

        <div class="text-caption text-grey-darken-1 mb-4 d-flex align-center">
            <v-progress-circular v-if="backendStatus !== 'COMPLETAT'" indeterminate size="12" width="2" class="mr-2"></v-progress-circular>
            {{ currentStatus }}
        </div>
        
        <v-alert density="compact" variant="tonal" color="info" size="small" icon="mdi-information">
          Pots sortir de la pàgina, t'avisarem quan acabi.
        </v-alert>
      </v-card>
    </div>

    <!-- Resultat de la IA -->
    <!-- Només mostrem el resultat quan NO estem carregant -->
    <div v-else-if="resumenIA">
      <!-- COMPONENT VISUAL (Restaurat) -->
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

    <!-- Error: Fitxer no trobat (NOU) -->
    <v-alert v-else-if="fileNotFound" type="warning" variant="tonal" class="mt-4" border="start" border-color="warning">
      <div class="d-flex align-center">
        <v-icon icon="mdi-file-remove-outline" class="mr-2" color="warning"></v-icon>
        <div><strong>Document no disponible:</strong> El fitxer no s'ha trobat al servidor.</div>
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
const currentRole = computed(() => route.query.role || 'docent'); // Rol per defecte

const loading = ref(true);
const loadingAI = ref(false);
const rawText = ref('');
const resumenIA = ref('');
const errorAI = ref(null);
const fileNotFound = ref(false);
const progress = ref(0);
const currentStatus = ref('Iniciant...');
const backendStatus = ref(''); // Estat real (LLEGINT, GENERANT, etc.)
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
    justificacio: [],
    adaptacions: [],
    avaluacio: [],
    recomanacions: []
  };

  // Definim els marcadors amb REGEX per detectar les seccions que genera la IA
  const markers = [
    // MODIFICAT: Regex arreglades. Ara accepten '.' com a separador i NO tenen '.*' al final per no menjar-se el text.
    { key: 'perfil', regex: /(?:^|[\.\n])\s*(?:[\*#]*\s*\d?\.?\s*)?(?:PERFIL DE L'ALUMNE|DADES PERSONALS)/i },
    { key: 'dificultats', regex: /(?:^|[\.\n])\s*(?:[\*#]*\s*\d?\.?\s*)?(?:DIAGNÒSTIC|DIFICULTATS|NECESSITATS)/i },
    { key: 'justificacio', regex: /(?:^|[\.\n])\s*(?:[\*#]*\s*\d?\.?\s*)?(?:JUSTIFICACIÓ DEL PI|JUSTIFICACIÓ)/i },
    { key: 'recomanacions', regex: /(?:^|[\.\n])\s*(?:[\*#]*\s*\d?\.?\s*)?(?:ORIENTACIÓ A L'AULA|ORIENTACIONS)/i },
    { key: 'adaptacions', regex: /(?:^|[\.\n])\s*(?:[\*#]*\s*\d?\.?\s*)?(?:ASSIGNATURES|MATÈRIES|ADAPTACIONS|MESURES I SUPORTS|SEGUIMENT)/i },
    { key: 'avaluacio', regex: /(?:^|[\.\n])\s*(?:[\*#]*\s*\d?\.?\s*)?(?:CRITERIS D'AVALUACIÓ|AVALUACIÓ)/i }
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
    
    // MILLORA: Forcem salts de línia si la IA els ha oblidat (ex: "text.Next" -> "text.\nNext")
    // També separem els asteriscs (*) si estan enganxats
    const processedText = sectionText
      .replace(/([a-z0-9à-ú])\.([A-Z\*])/g, '$1.\n$2') // Punt seguit de Majúscula o *
      .replace(/([a-z0-9à-ú])\.\s+([A-Z\*])/g, '$1.\n$2'); // Punt + espai seguit de Majúscula o *

    result[current.key] = processedText.split('\n').filter(l => l.trim().length > 0);
  }

  return result;
});

const analyzeDocument = async () => {
  if (!filename) return;
  loading.value = true;

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
};

onMounted(() => {
  analyzeDocument();
});

onUnmounted(() => {
  if (pollingInterval) clearInterval(pollingInterval);
});

const checkStatus = async () => {
  try {
    const response = await fetch('http://localhost:3001/api/students');
    if (!response.ok) {
        console.warn(`⚠️ [API] El servidor ha retornat un error ${response.status}. Reintentant en el següent cicle...`);
        return; 
    }
    
    const students = await response.json();
    
    // VALIDACIÓ CRÍTICA: Assegurem que tenim un array abans de fer .find()
    if (!Array.isArray(students)) {
        console.error("❌ [API] La resposta no és un llistat vàlid:", students);
        return;
    }

    // Busquem l'alumne que tingui aquest fitxer
    const student = students.find(s => s.filename === filename || (s.files && s.files.some(f => f.filename === filename)));
    
    if (student) console.log("🔍 [Frontend] Estat rebut:", student.ia_data);

    if (student && student.ia_data) {
      const estado = student.ia_data.estado;
      backendStatus.value = estado;
      
      if (estado === 'COMPLETAT' && student.ia_data.resumen) {
        resumenIA.value = student.ia_data.resumen;
        
        // Si el rol guardat és diferent del que volem, regenerem automàticament
        if (student.ia_data.role && student.ia_data.role !== currentRole.value) {
            console.log(`🔄 Rol diferent detectat (DB: ${student.ia_data.role} vs ACTUAL: ${currentRole.value}). Regenerant...`);
            regenerarResumenIA();
            return;
        }

        loadingAI.value = false;
        currentStatus.value = "Completat";
        if (pollingInterval) clearInterval(pollingInterval);
      } else if (estado === 'INTERROMPUT' || estado === 'ERROR') { // NOU: Detectem també ERROR
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
          if (estado === 'A LA CUA') {
            // NOU: Consultem la posició real a la cua
            try {
                const qRes = await fetch('http://localhost:3001/api/queue-status');
                if (qRes.ok) {
                    const qData = await qRes.json();
                    const index = qData.queue.indexOf(filename);
                    
                    if (index === 0) {
                        currentStatus.value = "Ets el següent! Preparant...";
                    } else if (index > 0) {
                        currentStatus.value = `En cua d'espera... (Tens ${index} resums davant)`;
                    } else {
                        currentStatus.value = "En cua d'espera...";
                    }
                }
            } catch (e) { currentStatus.value = 'En cua d\'espera...'; }
          }
          else if (estado === 'LLEGINT...') {
            // Missatge fix durant la lectura real (sense simulació)
            currentStatus.value = 'Llegint document (això pot trigar uns minuts)...';
          }
          else currentStatus.value = 'Preparant resposta...';
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
        filename: filename, // Important per saber a qui actualitzar
        role: currentRole.value // NOU: Enviem el rol seleccionat
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