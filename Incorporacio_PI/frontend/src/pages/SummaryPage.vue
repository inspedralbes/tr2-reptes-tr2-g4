<template>
  <v-container>
    <div class="d-flex align-center mb-6">
      <v-btn icon="mdi-arrow-left" variant="text" @click="$router.back()" class="mr-2"></v-btn>
      <div>
        <h1 class="text-h4 font-weight-bold">
          <v-icon icon="mdi-robot-outline" color="primary" class="mr-2"></v-icon>
          Anàlisi Intel·ligent
        </h1>
        <p class="text-caption text-grey-darken-1 text-truncate" style="max-width: 400px;">{{ filename }}</p>
      </div>
      <v-spacer></v-spacer>
      <v-chip :color="currentRole === 'docent' ? 'indigo-lighten-4' : 'teal-lighten-4'" class="mr-4" variant="flat">
        <v-icon start size="small" :color="currentRole === 'docent' ? 'indigo' : 'teal'">
          {{ currentRole === 'docent' ? 'mdi-account-school' : 'mdi-account-tie' }}
        </v-icon>
        Perfil: {{ currentRole.toUpperCase() }}
      </v-chip>
    </div>

    <!-- Estat de Càrrega / Processament Actiu -->
    <v-card v-if="loading || loadingAI" variant="flat" border class="pa-10 text-center mx-auto" max-width="600" rounded="xl">
      <div class="processing-animation mb-6">
        <v-icon size="84" :color="statusColor" :class="statusClass">mdi-robot-vacuum-variant</v-icon>
      </div>
      
      <h2 class="text-h5 mb-2 font-weight-black text-grey-darken-3 text-uppercase" style="letter-spacing: 1px;">
        {{ statusMessage.title }}
      </h2>
      <p class="text-body-2 text-grey-darken-1 mb-8" style="max-width: 450px; margin: 0 auto;">
        {{ statusMessage.description }}
      </p>

      <v-progress-linear color="primary" height="10" indeterminate rounded="pill" class="mb-8"></v-progress-linear>

      <v-alert type="info" variant="tonal" density="compact" class="text-left border-subtle">
        <template v-slot:prepend>
          <v-icon icon="mdi-clock-outline"></v-icon>
        </template>
        <div class="text-caption">
          <v-icon icon="mdi-shield-check-outline" size="x-small" class="mr-1"></v-icon>
          <strong>Anàlisi en curs:</strong> La IA està processant el contingut per garantir una extracció <strong>precisa i fiable</strong> de les dades. 
          Aquest procés pot requerir uns instants; l'anàlisi apareixerà aquí automàticament.
        </div>
      </v-alert>
    </v-card>

    <!-- Resultat Final -->
    <div v-else-if="resumenIA">
      <PiSummary :analysis="parsedAnalysis" :role="currentRole" />
      <div class="d-flex justify-center mt-6">
        <v-btn prepend-icon="mdi-refresh" variant="text" color="primary" @click="regenerarResumenIA" :loading="loadingAI">
            Regenerar anàlisi
        </v-btn>
      </div>
    </div>

    <!-- Estat d'Error amb Intent de nou automàtic o senzill -->
    <v-card v-else variant="flat" border class="pa-10 text-center mx-auto" max-width="600" rounded="xl">
      <v-icon size="64" color="error" class="mb-4">mdi-alert-circle-outline</v-icon>
      <h2 class="text-h5 mb-4 text-grey-darken-3">Error en el processament</h2>
      <p class="text-body-1 text-grey-darken-1 mb-8">
        {{ errorMessage || "No s'ha pogut completar l'anàlisi automàticament." }}
      </p>
      
      <v-btn 
        color="primary" 
        size="large" 
        prepend-icon="mdi-sync" 
        block 
        rounded="lg"
        @click="regenerarResumenIA"
        :loading="loadingAI"
      >
        Tornar a intentar ara
      </v-btn>
    </v-card>

    <v-snackbar v-model="showError" color="error" location="top" timeout="3000">
      {{ errorMessage }}
    </v-snackbar>
  </v-container>
</template>

<script setup>
import { ref, onMounted, computed, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const filename = route.params.filename;
const currentRole = computed(() => route.query.role || 'docent');

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

const checkStatusAndStart = async () => {
  loading.value = true;
  try {
    const res = await fetch('http://localhost:3001/api/students');
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
        // SI NO ESTÀ COMPLET, L'INICIEM DIRECTAMENT SENSE PREGUNTAR
        await regenerarResumenIA();
      }
    }
  } catch (e) { 
    console.error(e);
    loading.value = false;
  }
};

const startSSE = () => {
  if (processSSE) return;
  processSSE = new EventSource(`http://localhost:3001/api/progress/${filename}`);
  processSSE.onmessage = (e) => {
    const data = JSON.parse(e.data);
    if (data.status === 'CONNECTED') return;
    if (data.role && data.role !== currentRole.value && data.role !== 'global') return;
    
    loadingAI.value = true;
    loading.value = false;
    backendStatus.value = data.status === 'LLEGINT...' ? 'LLEGINT EL DOCUMENT' : (data.status === 'GENERANT...' ? 'GENERANT EL RESUM' : data.status);
    
    if (data.status === 'COMPLETAT') {
      resumenIA.value = data.resumen;
      loadingAI.value = false;
      processSSE.close();
      processSSE = null;
    } else if (data.status === 'ERROR') {
      errorMessage.value = "La IA ha trobat un problema tèncnic.";
      showError.value = true;
      loadingAI.value = false;
      processSSE.close();
      processSSE = null;
    }
  };
};

const statusColor = computed(() => {
    if (backendStatus.value === 'A LA CUA') return 'grey';
    if (backendStatus.value === 'LLEGINT EL DOCUMENT') return 'blue';
    if (backendStatus.value === 'GENERANT EL RESUM') return 'purple-darken-2';
    return 'primary';
});

const statusClass = computed(() => {
    if (backendStatus.value === 'GENERANT EL RESUM') return 'robot-pulse-fast';
    if (backendStatus.value === 'LLEGINT EL DOCUMENT') return 'robot-scan';
    return 'robot-pulse';
});

const statusMessage = computed(() => {
    if (backendStatus.value === 'A LA CUA') {
        return { title: 'DINS LA CUA', description: 'Hi ha altres tasques pendents. En un moment ens posem amb el teu document.' };
    }
    if (backendStatus.value === 'LLEGINT EL DOCUMENT') {
        return { title: 'LLEGINT DADES', description: 'La IA s\'està llegint el fitxer paraula per paraula per entendre el context.' };
    }
    if (backendStatus.value === 'GENERANT EL RESUM') {
        return { title: 'SINTETITZANT', description: 'Estem redactant el resum personalitzat basat en les dades extretes.' };
    }
    return { title: 'INICIANT PROCÉS', description: 'Connectant amb el servidor d\'Intel·ligència Artificial...' };
});

const regenerarResumenIA = async () => {
    loadingAI.value = true;
    resumenIA.value = '';
    backendStatus.value = 'CONTACTANT IA...';
    
    try {
        const isGlobal = !filename.includes('.'); 
        if (isGlobal) {
            await fetch('http://localhost:3001/api/generate-global-summary', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ studentHash: filename, userEmail: localStorage.getItem('userEmail') || 'usuari' })
            });
            backendStatus.value = 'A LA CUA';
        } else {
            const res = await fetch(`http://localhost:3001/api/analyze/${encodeURIComponent(filename)}`);
            if (!res.ok) throw new Error("Document no trobat. Revisa si s'ha esborrat.");
            const data = await res.json();
            
            const genRes = await fetch('http://localhost:3001/api/generate-summary', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: data.text_completo, filename, role: currentRole.value, userEmail: localStorage.getItem('userEmail') || 'usuari' })
            });
            if (!genRes.ok) throw new Error("Error en la cua de la IA.");
            backendStatus.value = 'A LA CUA';
        }
        startSSE();
    } catch (e) { 
        console.error(e);
        errorMessage.value = e.message;
        showError.value = true;
        loadingAI.value = false;
    }
};

onMounted(() => checkStatusAndStart());
onUnmounted(() => { if (processSSE) processSSE.close(); });
</script>

<style scoped>
.robot-pulse { animation: pulse-primary 3s infinite; }
.robot-pulse-fast { animation: pulse-primary 1s infinite; }
.robot-scan { animation: scan-move 2s infinite ease-in-out; }

@keyframes scan-move {
  0% { transform: translateY(-10px); }
  50% { transform: translateY(10px); }
  100% { transform: translateY(-10px); }
}

@keyframes pulse-primary {
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.1); opacity: 0.7; }
  100% { transform: scale(1); opacity: 1; }
}
.border-subtle { border: 1px solid rgba(0,0,0,0.1) !important; }
</style>
