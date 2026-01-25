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
      <v-card variant="flat" border class="pa-8 w-100" max-width="500" rounded="xl">
        <v-icon size="64" color="primary" class="mb-4">mdi-robot-vacuum-variant</v-icon>
        <h2 class="text-h5 mb-2">Processant Document</h2>
        <p class="text-body-2 text-grey-darken-1 mb-6">L'IA està analitzant cada detall per crear el millor resum.</p>
        
        <!-- STEPPER VISUAL (NOU) -->
        <div class="d-flex justify-space-between align-start mb-8 px-2 w-100">
          <!-- Pas 1: Cua -->
          <div class="d-flex flex-column align-center" style="width: 30%">
            <v-avatar :color="getStepState(1) === 'completed' ? 'green-lighten-5' : (getStepState(1) === 'active' ? 'blue-lighten-5' : 'grey-lighten-4')" size="40" class="mb-2">
                <v-icon :color="getStepState(1) === 'completed' ? 'success' : (getStepState(1) === 'active' ? 'primary' : 'grey-lighten-1')" size="20">
                {{ getStepState(1) === 'completed' ? 'mdi-check' : 'mdi-tray-full' }}
                </v-icon>
            </v-avatar>
            <div class="text-caption font-weight-bold text-center lh-1" :class="{'text-primary': getStepState(1) === 'active', 'text-grey': getStepState(1) === 'pending'}">En cua</div>
          </div>

          <!-- Connector 1-2 -->
          <v-divider class="mt-5" :color="getStepState(1) === 'completed' ? 'success' : 'grey-lighten-2'" style="opacity: 1; border-width: 2px" thickness="2"></v-divider>

          <!-- Pas 2: Lectura -->
          <div class="d-flex flex-column align-center" style="width: 30%">
            <v-avatar :color="getStepState(2) === 'completed' ? 'green-lighten-5' : (getStepState(2) === 'active' ? 'blue-lighten-5' : 'grey-lighten-4')" size="40" class="mb-2">
                <v-icon :color="getStepState(2) === 'completed' ? 'success' : (getStepState(2) === 'active' ? 'primary' : 'grey-lighten-1')" size="20">
                {{ getStepState(2) === 'completed' ? 'mdi-check' : 'mdi-book-search' }}
                </v-icon>
            </v-avatar>
            <div class="text-caption font-weight-bold text-center lh-1" :class="{'text-primary': getStepState(2) === 'active', 'text-grey': getStepState(2) === 'pending'}">Llegint</div>
          </div>

          <!-- Connector 2-3 -->
          <v-divider class="mt-5" :color="getStepState(2) === 'completed' ? 'success' : 'grey-lighten-2'" style="opacity: 1; border-width: 2px" thickness="2"></v-divider>

          <!-- Pas 3: Escriptura -->
          <div class="d-flex flex-column align-center" style="width: 30%">
            <v-avatar :color="getStepState(3) === 'completed' ? 'green-lighten-5' : (getStepState(3) === 'active' ? 'blue-lighten-5' : 'grey-lighten-4')" size="40" class="mb-2">
                <v-icon :color="getStepState(3) === 'completed' ? 'success' : (getStepState(3) === 'active' ? 'primary' : 'grey-lighten-1')" size="20">
                {{ getStepState(3) === 'completed' ? 'mdi-check' : 'mdi-pencil-outline' }}
                </v-icon>
            </v-avatar>
            <div class="text-caption font-weight-bold text-center lh-1" :class="{'text-primary': getStepState(3) === 'active', 'text-grey': getStepState(3) === 'pending'}">Generant</div>
          </div>
        </div>

        <!-- BARRA DE PROGRÉS UNIFICADA -->
        <div class="mb-6">
          <div class="d-flex justify-space-between align-end mb-2">
            <span class="text-subtitle-2 font-weight-bold text-primary">{{ backendStatus === 'LLEGINT...' ? 'LECTURA ANALÍTICA' : 'GENERANT RESUM' }}</span>
            <!-- Porcentaje oculto por petición del usuario -->
          </div>
          
          <v-progress-linear 
            color="primary" 
            height="12" 
            :model-value="progress"
            rounded="pill"
            striped 
          ></v-progress-linear>
        </div>

        <div class="text-body-2 text-grey-darken-2 mb-6 d-flex align-center justify-center">
            <v-progress-circular v-if="backendStatus !== 'COMPLETAT'" indeterminate size="16" width="2" class="mr-3" color="primary"></v-progress-circular>
            {{ currentStatus }}
        </div>
        
        <v-divider class="mb-6"></v-divider>

        <v-alert density="compact" variant="tonal" color="info" rounded="lg" icon="mdi-shield-check-outline">
          <div class="text-caption">Privacitat garantida: El processament es realitza 100% en local.</div>
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
      <v-btn class="mt-2 ml-8" variant="outlined" size="small" @click="retryAndQueue">Tornar a provar i Generar</v-btn>
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
  let text = resumenIA.value || '';
  const result = {
    perfil: [], dificultats: [], justificacio: [], adaptacions: [], avaluacio: [], recomanacions: []
  };

  // 1. INTENT DE PARSEJAR COM A JSON (Prioritat Màxima)
  try {
    // Netejem possibles blocs markdown (```json ... ```)
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    if (jsonStr.startsWith('{')) {
      const data = JSON.parse(jsonStr);
      
      // MAPATGE DE CLAUS JSON -> VISTA
      // Docent: PERFIL, ORIENTACIÓ, ADAPTACIONS, CRITERIS
      // Orientador: PERFIL, DIAGNÒSTIC, JUSTIFICACIÓ, MATÈRIES, ORIENTACIÓ
      
      if (data.PERFIL) result.perfil = Array.isArray(data.PERFIL) ? data.PERFIL : [data.PERFIL];
      
      if (data.DIAGNÒSTIC) result.dificultats = Array.isArray(data.DIAGNÒSTIC) ? data.DIAGNÒSTIC : [data.DIAGNÒSTIC];
      // Docent no té 'DIAGNÒSTIC' explícit al JSON nou, però si n'hi hagués...
      
      if (data.JUSTIFICACIÓ) result.justificacio = Array.isArray(data.JUSTIFICACIÓ) ? data.JUSTIFICACIÓ : [data.JUSTIFICACIÓ];
      
      if (data.ORIENTACIÓ) result.recomanacions = Array.isArray(data.ORIENTACIÓ) ? data.ORIENTACIÓ : [data.ORIENTACIÓ];
      
      if (data.ADAPTACIONS) result.adaptacions = Array.isArray(data.ADAPTACIONS) ? data.ADAPTACIONS : [data.ADAPTACIONS];
      if (data.MATÈRIES) result.adaptacions.push(...(Array.isArray(data.MATÈRIES) ? data.MATÈRIES : [data.MATÈRIES]));
      
      if (data.CRITERIS) result.avaluacio = Array.isArray(data.CRITERIS) ? data.CRITERIS : [data.CRITERIS];
      if (data.AVALUACIÓ) result.avaluacio.push(...(Array.isArray(data.AVALUACIÓ) ? data.AVALUACIÓ : [data.AVALUACIÓ]));

      // Si hem trobat alguna cosa, retornem
      if (Object.values(result).some(arr => arr.length > 0)) return result;
    }
  } catch (e) {
    console.warn("⚠️ El text no és un JSON vàlid. Provant mode text manual...", e);
  }

  // 2. PARSING LEGACY BASAT EN TEXT (Fallback)
  const markers = [
    { key: 'perfil', regex: /(?:^|[\.\n])\s*(?:[\*#]*\s*\d?\.?\s*)?(?:PERFIL HUMÀ I DIFICULTATS|PERFIL DE L'ALUMNE|PERFIL)/i },
    { key: 'dificultats', regex: /(?:^|[\.\n])\s*(?:[\*#]*\s*\d?\.?\s*)?(?:DIAGNÒSTIC|DIFICULTATS|NECESSITATS)/i },
    { key: 'justificacio', regex: /(?:^|[\.\n])\s*(?:[\*#]*\s*\d?\.?\s*)?(?:JUSTIFICACIÓ DEL PI|JUSTIFICACIÓ)/i },
    { key: 'recomanacions', regex: /(?:^|[\.\n])\s*(?:[\*#]*\s*\d?\.?\s*)?(?:ORIENTACIÓ A L'AULA|ORIENTACIONS|RECOMANACIONS|PAUTES)/i },
    { key: 'adaptacions', regex: /(?:^|[\.\n])\s*(?:[\*#]*\s*\d?\.?\s*)?(?:ADAPTACIONS PER ASSIGNATURES|ASSIGNATURES|MATÈRIES|ADAPTACIONS|SUPORTS)/i },
    { key: 'avaluacio', regex: /(?:^|[\.\n])\s*(?:[\*#]*\s*\d?\.?\s*)?(?:CRITERIS DE QUALIFICACIÓ|CRITERIS D'AVALUACIÓ|AVALUACIÓ|QUALIFICACIÓ)/i }
  ];

  const positions = markers.map(m => {
      const match = text.match(m.regex);
      return match ? { key: m.key, index: match.index, labelLength: match[0].length } : null;
  }).filter(p => p !== null).sort((a, b) => a.index - b.index);

  // FALLBACK: Si no trobem cap títol però tenim text, ho posem tot a 'Perfil' per a que es vegi
  if (positions.length === 0 && text.trim().length > 0) {
      console.warn("⚠️ No s'han detectat seccions. Mostrant text en brut.");
      return { ...result, perfil: text.split('\n').filter(l => l.trim().length > 0) };
  }

  for (let i = 0; i < positions.length; i++) {
    const current = positions[i];
    const next = positions[i + 1];
    const start = current.index + current.labelLength;
    const end = next ? next.index : text.length;
    const sectionText = text.substring(start, end).trim();
    
    // Neteja extra per a llistes
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
  currentStatus.value = "Descarregant contingut del document...";

  // Intentem 3 vegades per si el servidor just està arrencant
  let attempts = 0;
  let success = false;

  while (attempts < 3 && !success) {
      try {
        attempts++;
        const response = await fetch(`http://localhost:3001/api/analyze/${encodeURIComponent(filename)}`);
        
        if (response.ok) {
          const data = await response.json();
          rawText.value = data.text_completo;
          console.log("📄 Text del document carregat correctament.");
          success = true;
        } else {
          if (response.status === 404) {
            fileNotFound.value = true;
            success = true; // No cal reintentar si no existeix
          } else {
            console.warn(`⚠️ Intent ${attempts}/3 fallit: Servidor ${response.status}`);
            if (attempts < 3) await new Promise(r => setTimeout(r, 1000));
          }
        }
      } catch (error) {
        console.warn(`⚠️ Intent ${attempts}/3 fallit: Error xarxa`, error);
        if (attempts < 3) await new Promise(r => setTimeout(r, 1000)); // Espera 1s
      }
  }

  // 2. INDEPENDENTMENT de si hem baixat el text, mirem l'estat a la BD.
  loading.value = false; // Ara sí, acabem càrrega inicial
  checkStatus();
};

onMounted(async () => {
  // 1. Iniciem càrrega
  await analyzeDocument();
  
  // 2. Esperem una mica a que checkStatus s'actualitzi
  // (per si l'estat inicial és 'INTERROMPUT' i cal autoregenerar)
  setTimeout(() => {
      // Si després de carregar, no estem carregant i hi ha error/buit, forcem
      if (!loadingAI.value && !resumenIA.value && !pollingInterval) {
          // Double-check de l'estat per si de cas
          if (backendStatus.value === 'INTERROMPUT' || backendStatus.value === 'ERROR' || !backendStatus.value) {
             console.log("🚀 [Mount] Autoregenerant estat invàlid inicial...");
             regenerarResumenIA();
          }
      }
  }, 1000);
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
    
    if (!Array.isArray(students)) {
        console.error("❌ [API] La resposta no és un llistat vàlid:", students);
        return;
    }

    // Busquem l'alumne que tingui aquest fitxer
    const student = students.find(s => s.filename === filename || (s.files && s.files.some(f => f.filename === filename)));
    
    // Busquem la ia_data específica d'aquest fitxer (pot estar al top-level o dins de files)
    let iaData = null;
    if (student) {
      // FIX: Prioritzem la cerca dins de l'array 'files', que és on el worker i la nova API escriuen
      console.log(`🔍 [Debug] Buscant fitxer: '${filename}' en array de ${student.files ? student.files.length : 0} elements.`);
      
      if (student.files) {
        // Normalització per evitar errors d'espais o encoding
        const file = student.files.find(f => f.filename === filename || decodeURIComponent(f.filename) === decodeURIComponent(filename));
        if (file) {
            console.log("   ✅ Fitxer trobat a l'array:", file.filename);
            iaData = file.ia_data;
        } else {
            console.warn("   ⚠️ Fitxer NO trobat a l'array. Noms disponibles:", student.files.map(f => f.filename));
        }
      }
      
      // Fallback: Si no el trobem a l'array, mirem si és el fitxer legacy (top-level)
      // Però NOMÉS si no tenim iaData ja
      if (!iaData && student.filename === filename) {
        console.log("   ℹ️ Usant dades legacy (Top Level)");
        iaData = student.ia_data;
      }
    }

    if (student && iaData) {
      const estado = iaData.estado;
      backendStatus.value = estado;
      
      console.log(`🔍 [Frontend] Estat per ${filename}:`, estado);

      // 1. SI JA ESTÀ COMPLETAT -> FI
      if (estado === 'COMPLETAT' && iaData.resumen) {
        console.log("✅ RESUM TROBAT! Mostrant resultat.");
        resumenIA.value = iaData.resumen;
        loadingAI.value = false;
        currentStatus.value = "Completat";
        if (pollingInterval) { clearInterval(pollingInterval); pollingInterval = null; }
        return;
      } 
      
      // 2. SI ESTÀ EN PROCÉS -> ACTUALITZAR BARRA
      if (['GENERANT...', 'A LA CUA', 'LLEGINT...'].includes(estado)) {
        loadingAI.value = true;
        const dbProgress = iaData.progress || 0;
        progress.value = estado === 'A LA CUA' ? 0 : dbProgress;
        
        if (estado === 'LLEGINT...') {
             // FIX: Forcem "Analitzant..." si IA està processant rawProgress > 0
             currentStatus.value = `Analitzant estructura i contingut... ${Math.ceil(progress.value)}%`;
        } else if (estado === 'GENERANT...') {
             currentStatus.value = `Redactant el resum final... ${Math.ceil(progress.value)}%`;
             if (iaData.resumen) resumenIA.value = iaData.resumen;
        } else {
             currentStatus.value = "Esperant torn a la cua...";
        }
        return; // Continuem esperant
      }

      // 3. SI ELIMINAT, ERROR, INTERROMPUT O BUIT
      else if ((estado === 'INTERROMPUT' || estado === 'ERROR')) {
        
        // NOU: Detecció de CRASH durant l'execució
        // Si estàvem carregant (loadingAI=true) i de cop passem a ERROR/INTERROMPUT, és un error NOU.
        // No l'hem d'ignorar. L'hem de gestionar (autoregenerar).
        
        if (loadingAI.value) {
             console.warn("⚠️ Crash detectat durant la generació! (LLEGINT -> INTERROMPUT)");
             loadingAI.value = false; // Reset per permetre nova regeneració
             
             // Opcional: Afegir petit delay per no saturar en bucle si falla molt ràpid
             setTimeout(() => {
                 regenerarResumenIA();
             }, 1000);
             return;
        }

        // Si NO estem carregant manualment, vol dir que hem entrat a la pàgina i estava trencat.
        if (!loadingAI.value) {
            console.log(`⚠️ Estat guardat invàlid (${estado}). Regenerant automàticament...`);
            regenerarResumenIA();
        } else {
            // Aquest cas teòricament ja no es dona amb l'if de dalt, 
            // però per seguretat (si loadingAI encara està true per una altra raó)
            console.log("⏳ Esperant canvi d'estat...");
        }
      }
    }

    // SEMPRE activem el polling si estem en mode loading, fins que tinguem un estat final
    // MODIFICAT: Més ràpid encara (0.5s) per caçar el progrés de la IA en temps real
    if (loadingAI.value && !pollingInterval) {
      pollingInterval = setInterval(checkStatus, 500);
    }

  } catch (e) {
    if (e.message === 'Failed to fetch') {
        console.warn("⚠️ [Polling] Error de xarxa temporal (servidor reiniciant?)...");
    } else {
        console.error("Error comprovant estat:", e);
    }
  }
};

// Funció visual per als passos
const getStepState = (step) => {
    const s = backendStatus.value;
    if (step === 1) { // Pas 1: Cua
        if (s === 'A LA CUA') return 'active';
        if (['LLEGINT...', 'GENERANT...', 'COMPLETAT'].includes(s)) return 'completed';
        return 'active'; // Per defecte actiu si no sabem l'estat (inici)
    }
    if (step === 2) { // Pas 2: Lectura
        if (s === 'LLEGINT...') return 'active';
        if (['GENERANT...', 'COMPLETAT'].includes(s)) return 'completed';
        if (s === 'A LA CUA') return 'pending';
        return 'pending';
    }
    if (step === 3) { // Pas 3: Escriptura
        if (s === 'GENERANT...') return 'active';
        if (s === 'COMPLETAT') return 'completed';
        return 'pending';
    }
    return 'pending';
};

const regenerarResumenIA = async () => {
  if (!rawText.value) {
      console.error("❌ No es pot regenerar: Falta el text del document (rawText buit).");
      // Intentem analitzar de nou d'emergència?
      // O mostrem error user-friendly
      errorAI.value = "No s'ha pogut llegir el text original del document. Prova a recarregar la pàgina.";
      return;
  }
  
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

const retryAndQueue = async () => {
  // 1. Intentem baixar el text si no el tenim
  if (!rawText.value) await analyzeDocument();
  
  // 2. Si ja el tenim (o l'hem baixat ara mateix), posem a la cua directament
  if (rawText.value) {
      console.log("🔄 Manual Retry: Envia a la cua automàticament...");
      await regenerarResumenIA();
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