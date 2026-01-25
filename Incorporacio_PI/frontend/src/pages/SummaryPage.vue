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
            <v-avatar :color="(getStepState(2) === 'completed' || getStepState(2) === 'active') ? 'green-lighten-5' : 'grey-lighten-4'" size="40" class="mb-2">
                <v-icon :color="(getStepState(2) === 'completed' || getStepState(2) === 'active') ? 'success' : 'grey-lighten-1'" size="20">
                {{ getStepState(2) === 'completed' ? 'mdi-check' : 'mdi-file-eye-outline' }}
                </v-icon>
            </v-avatar>
            <div class="text-caption font-weight-bold text-center lh-1" :class="{'text-success': getStepState(2) === 'active', 'text-grey': getStepState(2) === 'pending'}">Analitzant<br>document</div>
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
            <!-- Porcentaje visible SOLO si no estamos leyendo (generando) -->
            <span v-if="backendStatus !== 'LLEGINT...'" class="text-caption font-weight-bold text-primary">{{ Math.ceil(progress) }}%</span>
          </div>
          
          <v-progress-linear 
            color="primary" 
            height="12" 
            :model-value="progress"
            :indeterminate="backendStatus === 'LLEGINT...'"
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

  // 2. PARSING BASAT EN TEXT (Markdown Headers)
  // Normalitzem salts de línia
  const lines = text.split('\n');
  let currentKey = 'perfil'; // Per defecte tot va a perfil si no hi ha res més
  
  // Maps de títols a claus
  const sectionMap = {
    'PERFIL': 'perfil',
    'DIAGNÒSTIC': 'dificultats',
    'JUSTIFICACIÓ': 'justificacio',
    'ORIENTACIÓ': 'recomanacions', // Orientador/Docent
    'ORIENTACIÓ A L\'AULA': 'recomanacions',
    'ADAPTACIONS': 'adaptacions', // Orientador
    'ASSIGNATURES': 'adaptacions', // Docent
    'CRITERIS': 'avaluacio',
    'CRITERIS D\'AVALUACIÓ': 'avaluacio'
  };

  lines.forEach(line => {
    let trimmed = line.trim();
    // Detectem header markdown style: "## TÍTOL" o "### TÍTOL"
    // També acceptem "1. TÍTOL" si està en majúscules i és curt
    let isHeader = false;
    let headerContent = "";
    
    // 2. PARSING STRICTE BASAT EN TEXT (Markdown Headers)
    // Busquem línies que comencin per # o ## o ###
    if (trimmed.startsWith('#')) {
       // Netejem el hash i espais
       const headerContent = trimmed.replace(/^#+\s*/, '').toUpperCase();
       
       // Busquem quina secció és
       const foundKey = Object.keys(sectionMap).find(k => headerContent.includes(k));
       
       if (foundKey) {
          currentKey = sectionMap[foundKey];
          return; // IMPORTANT: No afegim la línia del títol al text visible (Evita duplicats)
       }
    }

    // Afegim la línia a la secció actual (Si no és buida)
    if (trimmed.length > 0 && !trimmed.startsWith('```')) {
      // Ignorem títols "al·lucinats" que no tinguin # però semblin títols
      const isHallucinatedTitle = Object.keys(sectionMap).some(k => trimmed.toUpperCase() === k || trimmed.toUpperCase() === k + ':');
      if (!isHallucinatedTitle) {
          result[currentKey].push(trimmed);
      }
    }
  });

  return result;
});

const analyzeDocument = async () => {
  if (!filename) return;
  loading.value = true;
  currentStatus.value = "Analitzant contingut...";

  // Intentem 3 vegades per si el servidor just està arrencant
  let attempts = 0;
  let success = false;

  while (attempts < 3 && !success) {
      try {
        attempts++;
        const response = await fetch(`/api/analyze/${encodeURIComponent(filename)}`);
        
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
    const response = await fetch('/api/students');
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
      
      let fileData = null;
      if (student.files) {
        // Normalització per evitar errors d'espais o encoding
        const file = student.files.find(f => f.filename === filename || decodeURIComponent(f.filename) === decodeURIComponent(filename));
        if (file) {
            console.log("   ✅ Fitxer trobat a l'array:", file.filename);
            fileData = file.ia_data;
        } else {
            console.warn("   ⚠️ Fitxer NO trobat a l'array. Noms disponibles:", student.files.map(f => f.filename));
        }
      }
      
      // Fallback: Si no el trobem a l'array, mirem si és el fitxer legacy (top-level)
      if (!fileData && student.filename === filename) {
        console.log("   ℹ️ Usant dades legacy (Top Level)");
        fileData = student.ia_data;
      }

      // SELECCIÓ PER ROL (MULTI-RESUM)
      if (fileData) {
         // Si existeix la clau del rol específic (nova versió)
         if (fileData[currentRole.value]) {
             iaData = fileData[currentRole.value];
         } 
         // Si no, mirem si és la versió antiga (objecte directe) i coincideix el rol (o assumim docent)
         else if (fileData.estado && (!fileData.role || fileData.role === currentRole.value || currentRole.value === 'docent')) {
             iaData = fileData;
         }
      }
    }

    if (student && iaData) {
      const estado = iaData.estado;
      backendStatus.value = estado;
      
      console.log(`🔍 [Frontend] Estat per ${filename} (${currentRole.value}):`, estado);

      // 1. SI JA ESTÀ COMPLETAT -> FI
      if (estado === 'COMPLETAT' && iaData.resumen) {
        console.log("✅ RESUM TROBAT! Mostrant resultat.");
        resumenIA.value = iaData.resumen;
        loadingAI.value = false;
        currentStatus.value = "Completat";
        return;
      } 
      
      // 2. SI ESTÀ EN PROCÉS -> ACTIVAR SSE
      if (['GENERANT...', 'A LA CUA', 'LLEGINT...'].includes(estado)) {
        loadingAI.value = true;
        // Iniciar SSE si no existe
        if (!processSSE) startSSE();
        return; 
      }

      // 3. SI ELIMINAT, ERROR, INTERROMPUT O BUIT
      else if ((estado === 'INTERROMPUT' || estado === 'ERROR')) {
        if (!loadingAI.value) {
            console.log(`⚠️ Estat guardat invàlid (${estado}). Regenerant automàticament...`);
            regenerarResumenIA();
        }
      }
    } else {
        // Si no hi ha dades per aquest rol, potser cal regenerar?
        // Deixem que l'usuari ho faci manual o ho forcem si està buit?
        // Millor no forçar automàticament per no gastar tokens, mostrem estat buit.
        console.log(`ℹ️ No hi ha resum per al rol: ${currentRole.value}`);
        loadingAI.value = false;
        resumenIA.value = '';
    }

  } catch (e) {
    console.error("Error comprovant estat:", e);
  }
};

// --- SSE (Server-Sent Events) ---
let processSSE = null;

const startSSE = () => {
    if (processSSE) return; // Ja connectat
    
    console.log("🔌 Connectant SSE per:", filename);
    processSSE = new EventSource(`/api/progress/${filename}`);
    
    processSSE.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.status === 'CONNECTED') {
                console.log("✅ SSE Connectat!");
                return;
            }
            
            // FILTRE DE ROL: Ignorem events d'altres rols
            if (data.role && data.role !== currentRole.value) return;

            // Actualitzem UI en temps real
            progress.value = data.progress;
            
            if (data.status === 'LLEGINT...') {
                backendStatus.value = 'LLEGINT...';
                currentStatus.value = `Analitzant document...`; // Sense % perquè és fals
            } else if (data.status === 'GENERANT...') {
                backendStatus.value = 'GENERANT...';
                currentStatus.value = `Redactant... ${Math.ceil(data.progress)}%`;
                if (data.resumen) resumenIA.value = data.resumen;
            } else if (data.status === 'COMPLETAT') {
                backendStatus.value = 'COMPLETAT';
                currentStatus.value = "Completat!";
                resumenIA.value = data.resumen;
                loadingAI.value = false;
                processSSE.close();
                processSSE = null;
            }
        } catch (e) {
            console.error("Error SSE:", e);
        }
    };
    
    processSSE.onerror = (err) => {
        console.warn("⚠️ SSE Error (reconnectant...)", err);
        processSSE.close();
        processSSE = null;
        setTimeout(startSSE, 2000);
    };
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
  currentStatus.value = 'Iniciant anàlisi...';
  
  try {
    const response = await fetch('/api/generate-summary', {
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