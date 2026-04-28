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
                  <v-icon :icon="isGlobal ? 'mdi-account-box-outline' : 'mdi-file-pdf-box'" size="small" color="#D0021B"
                    class="mr-2"></v-icon>
                  {{ displayName }}
                </div>
              </div>

              <v-chip :color="currentRole === 'docent' ? 'indigo-lighten-4' : 'teal-lighten-4'" class="font-weight-bold"
                variant="flat">
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
            <v-progress-linear color="purple-darken-2" height="6" indeterminate rounded
              class="mb-4"></v-progress-linear>
            <v-alert density="compact" variant="tonal" color="info"
              class="text-caption text-left border-subtle bg-blue-lighten-5">
              <template v-slot:prepend><v-icon size="small">mdi-shield-check</v-icon></template>
              La IA està processant el contingut de forma segura. Això pot trigar uns segons.
            </v-alert>
          </div>
        </v-card>

        <div v-else-if="resumenIA">
          <PiSummary :analysis="parsedAnalysis" :role="currentRole" />

          <div class="d-flex justify-center mt-8 mb-10">
            <v-btn prepend-icon="mdi-refresh" variant="outlined" color="grey-darken-3" class="bg-white mr-4"
              @click="regenerarResumenIA" :loading="loadingAI">
              Regenerar anàlisi
            </v-btn>

            <v-menu location="bottom">
              <template v-slot:activator="{ props }">
                <v-btn prepend-icon="mdi-download" color="primary" variant="flat" v-bind="props" :disabled="loadingAI">
                  Descarregar document
                </v-btn>
              </template>
              <v-list>
                <v-list-item @click="descarregarWord" prepend-icon="mdi-file-word"
                  title="Format Word (.doc)"></v-list-item>
                <v-list-item @click="descarregarPDF" prepend-icon="mdi-file-pdf-box"
                  title="Format PDF (.pdf)"></v-list-item>
              </v-list>
            </v-menu>
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
            <v-btn color="#D0021B" class="text-white" variant="flat" prepend-icon="mdi-refresh"
              @click="regenerarResumenIA">
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
import html2pdf from 'html2pdf.js';

const route = useRoute();
const filename = route.params.filename;
const currentRole = computed(() => route.query.role || 'docent');

const displayName = computed(() => route.query.originalName || (filename.length > 20 ? 'Document' : filename));
const isGlobal = computed(() => !filename.includes('.'));

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:3001');

const loading = ref(true);
const loadingAI = ref(false);
const resumenIA = ref('');
const currentStudent = ref(null);
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

    if (title.includes('PERFIL') || title.includes('EVOLUCIÓ') || title.includes('DADES')) {
      result.perfil.push({ title: title, content: content.join('\n') });
    }
    else if (title.includes('DIAGNÒSTIC') || title.includes('PUNTS CLAU') || title.includes('ANÀLISI')) {
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
  if (backendStatus.value === 'COMPLETAT') {
    return { title: 'FINALITZAT', description: 'El resum s\'ha generat correctament. Preparant la visualització...' };
  }
  return { title: 'INICIANT PROCÉS', description: 'Connectant amb el servidor d\'Intel·ligència Artificial...' };
});

const checkStatusAndStart = async () => {
  if (loadingAI.value) return;
  loading.value = true;
  try {
    const res = await fetch(`${API_URL}/api/students`);
    const students = await res.json();

    const student = students.find(s => s.hash_id === filename || s.files?.some(f => f.filename === filename));
    currentStudent.value = student;

    if (student) {
      let fileData = null;
      if (student.hash_id === filename) {
        fileData = student.global_summary;
      } else {
        const file = student.files.find(f => f.filename === filename);
        fileData = file?.ia_data?.[currentRole.value] || file?.ia_data;
      }

      if (fileData?.estado === 'COMPLETAT' && fileData.resumen) {
        resumenIA.value = fileData.resumen;
        loading.value = false;
        loadingAI.value = false;
        return;
      }

      if (fileData?.estado === 'A LA CUA' || fileData?.estado === 'LLEGINT...' || fileData?.estado === 'GENERANT...') {
        backendStatus.value = fileData.estado;
        loading.value = false;
        loadingAI.value = true;
        startSSE();
        return;
      }
    }

    await regenerarResumenIA();

  } catch (e) {
    console.error("Error checking status:", e);
    // Solo regenerar si no estamos ya en proceso
    if (!loadingAI.value) {
      await regenerarResumenIA();
    }
  }
};

const startSSE = () => {
  if (processSSE) return;
  processSSE = new EventSource(`${API_URL}/api/progress/${filename}`);

  processSSE.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      if (data.status === 'CONNECTED') return;

      // Ignorar si el rol no coincide (a menos que sea global)
      if (data.role && data.role !== currentRole.value && data.role !== 'global') return;

      loadingAI.value = true;
      loading.value = false;

      backendStatus.value = data.status;

      if (data.status === 'COMPLETAT') {
        resumenIA.value = data.resumen;
        loadingAI.value = false;
        loading.value = false; // Asegurar que ambos loading se desactivan
        processSSE.close();
        processSSE = null;
      } else if (data.status === 'ERROR') {
        errorMessage.value = data.message || "La IA ha trobat un problema tècnic.";
        showError.value = true;
        loadingAI.value = false;
        loading.value = false;
        processSSE.close();
        processSSE = null;
      }
    } catch (err) {
      console.error("SSE Parse Error", err);
    }
  };

  processSSE.onerror = (err) => {
    console.error("SSE Error:", err);
    if (loadingAI.value) {
      // Si hay error de conexión, intentamos verificar si el resumen ya está en la DB
      // en lugar de quedarnos cargando para siempre.
      setTimeout(() => {
        if (loadingAI.value) checkStatusAndStart();
      }, 2000);
      
      processSSE.close();
      processSSE = null;
    }
  };
};

const regenerarResumenIA = async () => {
  if (loadingAI.value && backendStatus.value !== '') return;

  loadingAI.value = true;
  resumenIA.value = '';
  backendStatus.value = 'A LA CUA';

  try {
    const userEmail = localStorage.getItem('userEmail') || 'usuari';

    if (isGlobal.value) {
      await fetch(`${API_URL}/api/generate-global-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentHash: filename, userEmail: userEmail })
      });
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

const getCommentsHTML = () => {
  if (!currentStudent.value?.comments || currentStudent.value.comments.length === 0) return '';
  
  let html = `<div style="page-break-before: always; margin-top: 40px; border-top: 2px solid #333; padding-top: 20px;">`;
  html += `<h1 style="color: #2c3e50; font-size: 22pt; margin-bottom: 20px;">Observacions i Comentaris</h1>`;
  
  currentStudent.value.comments.sort((a, b) => new Date(a.date) - new Date(b.date)).forEach(comment => {
    const dateStr = new Date(comment.date).toLocaleDateString('ca-ES', { 
      day: '2-digit', month: '2-digit', year: 'numeric', 
      hour: '2-digit', minute: '2-digit' 
    });
    const author = comment.type === 'docent' ? 'Docent' : (comment.type === 'alumne' ? 'Alumne' : 'Orientador');
    const color = comment.type === 'docent' ? '#3f51b5' : (comment.type === 'alumne' ? '#4caf50' : '#ff9800');
    
    html += `<div style="margin-bottom: 20px; padding: 15px; border-left: 5px solid ${color}; background-color: #f8f9fa; page-break-inside: avoid;">`;
    html += `<div style="font-weight: bold; color: ${color}; margin-bottom: 5px; font-size: 10pt;">${author} - ${dateStr}</div>`;
    html += `<div style="font-size: 11pt; line-height: 1.5; color: #444;">${comment.text.replace(/\n/g, '<br>')}</div>`;
    html += `</div>`;
  });
  
  html += `</div>`;
  return html;
};

const descarregarWord = () => {
  if (!resumenIA.value) return;

  let htmlContent = `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 800px; margin: 0 auto; color: #333;">`;
  htmlContent += `<h1 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; font-size: 24pt;">`;
  htmlContent += `Informe d'Anàlisi - ${displayName.value}</h1>`;
  htmlContent += `<p style="color: #7f8c8d; font-style: italic; font-size: 12pt;">Perfil: ${currentRole.value.toUpperCase()}</p>`;

  const sections = resumenIA.value.split(/##\s+/).filter(s => s.trim().length > 0);
  sections.forEach((section, index) => {
    const lines = section.split('\n');
    const title = lines[0].trim();
    const content = lines.slice(1).join('<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>');

    htmlContent += `<div style="page-break-inside: avoid; margin-bottom: 25pt;">`;
    if (index === 0 && !resumenIA.value.startsWith('##')) {
      htmlContent += `<p style="font-size: 11pt; line-height: 1.6;">${section.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</p>`;
    } else {
      htmlContent += `<h2 style="color: #2980b9; margin-top: 0; font-size: 18pt; border-bottom: 1px solid #ecf0f1; padding-bottom: 5pt; margin-bottom: 10pt;">${title}</h2>`;
      htmlContent += `<p style="font-size: 11pt; line-height: 1.6; text-align: justify;">${content}</p>`;
    }
    htmlContent += `</div>`;
  });
  htmlContent += getCommentsHTML();
  htmlContent += `</div>`;

  const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Resum IA</title></head><body>";
  const footer = "</body></html>";
  const sourceHTML = header + htmlContent + footer;

  const blob = new Blob(['\\ufeff', sourceHTML], {
    type: 'application/msword'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Resum_${currentRole.value}_${displayName.value.replace(/[^a-z0-9]/gi, '_')}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const descarregarPDF = () => {
  if (!resumenIA.value) return;

  let htmlContent = `<div style="font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; color: #333;">`;
  htmlContent += `<h1 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px;">`;
  htmlContent += `Informe d'Anàlisi - ${displayName.value}</h1>`;
  htmlContent += `<p style="color: #7f8c8d; font-style: italic;">Perfil: ${currentRole.value.toUpperCase()}</p>`;

  const sections = resumenIA.value.split(/##\s+/).filter(s => s.trim().length > 0);
  sections.forEach((section, index) => {
    const lines = section.split('\n');
    const title = lines[0].trim();
    const content = lines.slice(1).join('<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>');

    htmlContent += `<div style="page-break-inside: avoid; break-inside: avoid; margin-bottom: 30px;">`;
    if (index === 0 && !resumenIA.value.startsWith('##')) {
      htmlContent += `<p style="line-height: 1.6;">${section.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</p>`;
    } else {
      htmlContent += `<h2 style="color: #2980b9; margin-top: 0; border-bottom: 1px solid #eee; padding-bottom: 8px; margin-bottom: 12px;">${title}</h2>`;
      htmlContent += `<p style="line-height: 1.6; text-align: justify; margin-top: 0;">${content}</p>`;
    }
    htmlContent += `</div>`;
  });
  htmlContent += getCommentsHTML();
  htmlContent += `</div>`;

  const opt = {
    margin: 15,
    filename: `Resum_${currentRole.value}_${displayName.value.replace(/[^a-z0-9]/gi, '_')}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
  };

  const tempElement = document.createElement('div');
  tempElement.innerHTML = htmlContent;

  html2pdf().set(opt).from(tempElement).save();
};

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
  border-color: rgba(0, 0, 0, 0.1) !important;
}

.robot-pulse {
  animation: pulse-primary 3s infinite;
}

.robot-pulse-fast {
  animation: pulse-primary 1s infinite;
}

.robot-scan {
  animation: scan-move 2s infinite ease-in-out;
}

@keyframes scan-move {
  0% {
    transform: translateY(-5px);
  }

  50% {
    transform: translateY(5px);
  }

  100% {
    transform: translateY(-5px);
  }
}

@keyframes pulse-primary {
  0% {
    transform: scale(1);
    opacity: 1;
  }

  50% {
    transform: scale(1.1);
    opacity: 0.7;
  }

  100% {
    transform: scale(1);
    opacity: 1;
  }
}
</style>