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

          <div class="flex-grow-1">
            <div class="d-flex align-center justify-space-between">
              <div>
                <h1 class="text-h5 font-weight-black text-grey-darken-3 gencat-font mb-1">
                  Anàlisi Intel·ligent del Document
                </h1>
                <div
                  class="d-inline-flex align-center px-2 py-1 bg-white border rounded text-caption font-weight-bold text-grey-darken-2">
                  <v-icon :icon="isGlobal ? 'mdi-account-box-outline' : 'mdi-file-pdf-box'" size="small" color="#D0021B" class="mr-2"></v-icon>
                  {{ displayName }}
                </div>
              </div>

              <v-chip :color="currentRole === 'docent' ? 'indigo-lighten-4' : 'teal-lighten-4'" class="font-weight-bold" variant="flat">
                <v-icon start size="small" :color="currentRole === 'docent' ? 'indigo-darken-2' : 'teal-darken-2'">
                  {{ currentRole === 'docent' ? 'mdi-account-school' : 'mdi-account-tie' }}
                </v-icon>
                <span :class="currentRole === 'docent' ? 'text-indigo-darken-2' : 'text-teal-darken-2'">
                  PERFIL {{ currentRole.toUpperCase() }}
                </span>
              </v-chip>
            </div>
          </div>
        </div>

        <v-card v-if="loading || loadingAI" class="gencat-card py-12 text-center" elevation="0" rounded="lg">
          <div class="d-flex justify-center mb-6 processing-animation">
            <v-icon size="80" :color="statusColor" :class="statusClass">
               {{ backendStatus === 'LLEGINT...' ? 'mdi-text-box-search-outline' : 'mdi-robot-outline' }}
            </v-icon>
          </div>
          
          <h2 class="text-h6 font-weight-bold text-grey-darken-3 mb-2 text-uppercase" style="letter-spacing: 1px;">
            {{ statusMessage.title }}
          </h2>
          <p class="text-body-2 text-grey-darken-1 mb-6" style="max-width: 500px; margin: 0 auto;">
            {{ statusMessage.description }}
          </p>

          <div style="max-width: 400px; margin: 0 auto;">
            <v-progress-linear color="purple-darken-2" height="6" indeterminate rounded class="mb-4"></v-progress-linear>
            <v-alert density="compact" variant="tonal" color="info" class="text-caption text-left border-subtle bg-blue-lighten-5">
              <template v-slot:prepend><v-icon size="small">mdi-shield-check</v-icon></template>
              La IA està processant el contingut de forma segura. Això pot trigar uns segons.
            </v-alert>
          </div>
        </v-card>

        <div v-else-if="resumenIA">
          <PiSummary :analysis="parsedAnalysis" :role="currentRole" />
          
          <div class="d-flex justify-center mt-8 mb-10">
            <v-btn prepend-icon="mdi-refresh" variant="outlined" color="grey-darken-3" class="bg-white" @click="regenerarResumenIA" :loading="loadingAI">
                Regenerar anàlisi
            </v-btn>
          </div>
        </div>

        <v-card v-else class="gencat-card pa-8 text-center border-red" elevation="0" rounded="lg">
          <v-icon icon="mdi-alert-circle-outline" color="#D0021B" size="64" class="mb-4"></v-icon>
          <h3 class="text-h6 font-weight-bold text-grey-darken-3 mb-2">Error de Processament</h3>
          <p class="text-body-2 text-grey-darken-1 mb-6">
            {{ errorMessage || "No s'ha pogut analitzar el document automàticament." }}
          </p>
          <div class="d-flex justify-center gap-4">
            <v-btn color="grey-darken-3" variant="text" @click="$router.back()">
              Tornar
            </v-btn>
            <v-btn color="#D0021B" class="text-white" variant="flat" prepend-icon="mdi-refresh" @click="regenerarResumenIA">
              Tornar a intentar
            </v-btn>
          </div>
        </v-card>

      </v-col>
    </v-row>

    <v-snackbar v-model="showError" color="error" location="top" timeout="3000">
      {{ errorMessage }}
    </v-snackbar>
  </v-container>
</template>

<script setup>
import { ref, onMounted, computed, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import PiSummary from '@/components/PiSummary.vue';

const route = useRoute();
const filename = route.params.filename; 
const currentRole = computed(() => route.query.role || 'docent');

const displayName = computed(() => route.query.originalName || (filename.length > 20 ? 'Document' : filename));
const isGlobal = computed(() => !filename.includes('.'));

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:3001');

const loading = ref(true);
const loadingAI = ref(false);
const resumenIA = ref('');
const backendStatus = ref('');
const showError = ref(false);
const errorMessage = ref('');

let processSSE = null;

const parsedAnalysis = computed(() => {
  let text = resumenIA.value || '';
  const result = { perfil: [], dificultats: [], justificacio: [], adaptacions: [], avaluacio: [], recomanacions: [] };
  if (!text) return result;

  const sections = text.split(/##\s+/);
  sections.forEach(section => {
    const lines = section.split('\n');
    const title = lines[0].trim().toUpperCase();
    const content = lines.slice(1).map(l => l.trim()).filter(l => l.length > 2);
    
    if (title.includes('PERFIL') || title.includes('EVOLUCIÓ') || title.includes('EVOLUCIO') || title.includes('DADES')) {
        result.perfil.push({ title: title, content: content.join('\n') });
    }
    else if (title.includes('DIAGNÒSTIC') || title.includes('PUNTS CLAU') || title.includes('ANALISI')) {
        result.dificultats.push({ title: title, content: content.join('\n') });
    }
    else if (title.includes('JUSTIFICACIÓ') || title.includes('MOTIU')) {
        result.justificacio.push({ title: title, content: content.join('\n') });
    }
    else if (title.includes('ADAPTACIONS') || title.includes('ASSIGNATURES')) {
        result.adaptacions.push({ title: title, content: content.join('\n') });
    }
    else if (title.includes('AVALUACIÓ') || title.includes('CRITERIS')) {
        result.avaluacio.push({ title: title, content: content.join('\n') });
    }
    else if (title.includes('ORIENTACIÓ') || title.includes('RECOMANACIONS') || title.includes('ESTAT ACTUAL')) {
        result.recomanacions.push({ title: title, content: content.join('\n') });
    }
    else if (section.trim().length > 0) {
        result.perfil.push({ title: 'INFORMACIÓ GENERAL', content: section.trim() });
    }
  });
  return result;
});

const statusColor = computed(() => {
    if (backendStatus.value === 'A LA CUA') return 'grey';
    if (backendStatus.value === 'LLEGINT...') return 'blue';
    if (backendStatus.value === 'GENERANT...') return 'purple-darken-2';
    return 'grey-darken-3';
});

const statusClass = computed(() => {
    if (backendStatus.value === 'GENERANT...') return 'robot-pulse-fast';
    if (backendStatus.value === 'LLEGINT...') return 'robot-scan';
    return 'robot-pulse';
});

const statusMessage = computed(() => {
    if (backendStatus.value === 'A LA CUA') {
        return { title: 'EN CUA D\'ESPERA', description: 'Hi ha altres tasques pendents. En un moment ens posem amb el teu document.' };
    }
    if (backendStatus.value === 'LLEGINT...') {
        return { title: 'LLEGINT DADES', description: 'La IA s\'està llegint el fitxer paraula per paraula per entendre el context.' };
    }
    if (backendStatus.value === 'GENERANT...') {
        return { title: 'SINTETITZANT', description: 'Estem redactant el resum personalitzat basat en les dades extretes.' };
    }
    return { title: 'INICIANT PROCÉS', description: 'Connectant amb el servidor d\'Intel·ligència Artificial...' };
});

const checkStatusAndStart = async () => {
  loading.value = true;
  try {
    const res = await fetch(`${API_URL}/api/students`);
    const students = await res.json();
    
    const student = students.find(s => s.hash_id === filename || s.files?.some(f => f.filename === filename));
    
    if (student) {
      let fileData = null;
      if (student.hash_id === filename) {
        fileData = student.global_summary;
      } else {
        const file = student.files.find(f => f.filename === filename);
        fileData = file?.ia_data?.[currentRole.value] || file?.ia_data;
      }

      if (fileData?.estado === 'COMPLETAT') {
        resumenIA.value = fileData.resumen;
        loading.value = false;
      } else {
        await regenerarResumenIA();
      }
    } else {
        await regenerarResumenIA();
    }
  } catch (e) { 
    console.error(e);
    await regenerarResumenIA();
  }
};

const startSSE = () => {
  if (processSSE) return;
  processSSE = new EventSource(`${API_URL}/api/progress/${filename}`);
  
  processSSE.onmessage = (e) => {
    try {
        const data = JSON.parse(e.data);
        if (data.status === 'CONNECTED') return;
        
        if (data.role && data.role !== currentRole.value && data.role !== 'global') return;
        
        loadingAI.value = true;
        loading.value = false; 
        
        backendStatus.value = data.status; 
        
        if (data.status === 'COMPLETAT') {
          resumenIA.value = data.resumen;
          loadingAI.value = false;
          processSSE.close();
          processSSE = null;
        } else if (data.status === 'ERROR') {
          errorMessage.value = "La IA ha trobat un problema tècnic.";
          showError.value = true;
          loadingAI.value = false;
          processSSE.close();
          processSSE = null;
        }
    } catch(err) {
        console.error("SSE Parse Error", err);
    }
  };
  
  processSSE.onerror = () => {
      if (loadingAI.value) {
          console.log("SSE Connection closed");
          processSSE.close();
          processSSE = null;
      }
  };
};

const regenerarResumenIA = async () => {
    loadingAI.value = true;
    resumenIA.value = '';
    backendStatus.value = '';
    
    try {
        const userEmail = localStorage.getItem('userEmail') || 'usuari';
        
        if (isGlobal.value) {
            await fetch(`${API_URL}/api/generate-global-summary`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ studentHash: filename, userEmail: userEmail })
            });
            backendStatus.value = 'A LA CUA';
        } else {
            const res = await fetch(`${API_URL}/api/analyze/${encodeURIComponent(filename)}`);
            let textCompleto = "";
            
            if (res.ok) {
                const data = await res.json();
                textCompleto = data.text_completo;
            }
            
            const genRes = await fetch(`${API_URL}/api/generate-summary`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    text: textCompleto, 
                    filename: filename, 
                    role: currentRole.value, 
                    userEmail: userEmail 
                })
            });
            
            if (!genRes.ok) throw new Error("Error en la cua de la IA.");
            backendStatus.value = 'A LA CUA';
        }
        
        startSSE();
        
    } catch (e) { 
        console.error(e);
        errorMessage.value = e.message || "Error de connexió";
        showError.value = true;
        loadingAI.value = false;
        loading.value = false;
    }
};

onMounted(() => {
    checkStatusAndStart();
});

onUnmounted(() => { 
    if (processSSE) processSSE.close(); 
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
.border-subtle {
    border-color: rgba(0,0,0,0.1) !important;
}

.robot-pulse { animation: pulse-primary 3s infinite; }
.robot-pulse-fast { animation: pulse-primary 1s infinite; }
.robot-scan { animation: scan-move 2s infinite ease-in-out; }

@keyframes scan-move {
  0% { transform: translateY(-5px); }
  50% { transform: translateY(5px); }
  100% { transform: translateY(-5px); }
}

@keyframes pulse-primary {
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.1); opacity: 0.7; }
  100% { transform: scale(1); opacity: 1; }
}
</style>