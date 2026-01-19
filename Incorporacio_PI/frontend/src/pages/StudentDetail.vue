<template>
  <v-container>
    <v-btn
      class="mb-4"
      variant="text"
      prepend-icon="mdi-arrow-left"
      @click="goToList"
    >
      Tornar al llistat
    </v-btn>

    <div v-if="studentStore.loading && !student" class="d-flex justify-center mt-10">
      <v-progress-circular indeterminate color="primary" size="64"></v-progress-circular>
    </div>

    <v-card v-else-if="student" class="mx-auto pa-4" max-width="800" elevation="2">
      <v-card-title class="text-h5 font-weight-bold d-flex align-center">
        <v-avatar color="primary" class="mr-4" size="80">
          <span class="text-h4 text-white d-flex align-center justify-center w-100 h-100" style="line-height: 1;">{{ student.visual_identity?.iniciales }}</span>
        </v-avatar>
        Detall de l'Estudiant
      </v-card-title>
      
      <v-divider class="my-3"></v-divider>

      <v-card-text>
        <v-row>
          <v-col cols="12" md="6">
            <v-list-item>
              <template v-slot:prepend>
                <v-icon icon="mdi-account-circle-outline" color="primary"></v-icon>
              </template>
              <v-list-item-title>Inicials</v-list-item-title>
              <v-list-item-subtitle class="text-body-1">
                {{ student.visual_identity?.iniciales }}
              </v-list-item-subtitle>
            </v-list-item>
          </v-col>

          <v-col cols="12" md="6">
            <v-list-item>
              <template v-slot:prepend>
                <v-icon icon="mdi-identifier" color="primary"></v-icon>
              </template>
              <v-list-item-title>Sufix RALC</v-list-item-title>
              <v-list-item-subtitle class="text-body-1">
                {{ student.visual_identity?.ralc_suffix }}
              </v-list-item-subtitle>
            </v-list-item>
          </v-col>

          <v-col cols="12">
            <v-alert
              :color="student.has_file ? 'success' : 'warning'"
              :icon="student.has_file ? 'mdi-check-circle' : 'mdi-alert-circle'"
              variant="tonal"
              class="mt-2"
            >
              <div class="text-subtitle-1 font-weight-bold">
                Estat del Pla Individual (PI)
              </div>
              <div>
                {{ student.has_file ? "El document s'ha pujat correctament." : 'Pendent de pujar document.' }}
              </div>
            </v-alert>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <v-alert v-else type="error" variant="tonal" class="mt-4">
      No s'ha trobat cap estudiant amb aquest identificador.
    </v-alert>

    <!-- TARGETA RESUM GLOBAL (NOU) -->
    <v-card v-if="student" class="mx-auto mt-4 pa-4" max-width="800" elevation="2" border>
      <v-card-title class="text-h6 d-flex align-center justify-space-between bg-purple-lighten-5 text-purple-darken-4 rounded">
        <div class="d-flex align-center">
            <v-icon icon="mdi-text-box-multiple-outline" class="mr-2" color="purple"></v-icon>
            Resum Global (Historial)
        </div>
        <v-btn 
            v-if="!student.global_summary || (student.global_summary.estado !== 'GENERANT...' && student.global_summary.estado !== 'LLEGINT...')"
            color="purple" 
            variant="elevated" 
            size="small"
            prepend-icon="mdi-creation"
            @click="generateGlobalSummary"
        >
            {{ student.global_summary ? 'Regenerar' : 'Generar Resum' }}
        </v-btn>
      </v-card-title>
      
      <div class="pa-4">
          <div v-if="student.global_summary">
              <div v-if="['LLEGINT...', 'GENERANT...', 'A LA CUA'].includes(student.global_summary.estado)" class="text-center">
                  <v-progress-linear indeterminate color="purple" class="mb-2" height="6"></v-progress-linear>
                  <span class="text-caption font-weight-bold text-purple">{{ student.global_summary.estado }} ({{ Math.ceil(student.global_summary.progress || 0) }}%)</span>
                  <div v-if="student.global_summary.resumen" class="mt-2 text-body-2 text-grey font-italic">
                      "{{ student.global_summary.resumen.substring(0, 100) }}..."
                  </div>
              </div>
              <div v-else-if="student.global_summary.estado === 'COMPLETAT'" class="text-body-1" style="white-space: pre-line; line-height: 1.6;">
                  {{ student.global_summary.resumen }}
                  <div class="text-caption text-grey mt-3 text-right">Generat el: {{ formatDate(student.global_summary.fecha) }}</div>
              </div>
              <div v-else-if="student.global_summary.estado === 'ERROR'" class="text-error">
                  <v-icon icon="mdi-alert-circle" color="error" class="mr-1"></v-icon> Error: {{ student.global_summary.resumen }}
              </div>
          </div>
          <div v-else class="text-center text-grey py-4">
              <v-icon icon="mdi-robot-off" size="large" class="mb-2"></v-icon>
              <div>Encara no s'ha generat cap resum global de l'historial.</div>
          </div>
      </div>
    </v-card>

    <v-card v-if="student && normalizedFiles.length > 0" class="mx-auto mt-4 pa-4" max-width="800" elevation="2">
      <v-card-title class="text-h6 d-flex align-center">
        <v-icon icon="mdi-file-document-multiple-outline" class="mr-2" color="primary"></v-icon>
        Documents Adjunts
      </v-card-title>
      <v-divider class="my-2"></v-divider>

      <v-list lines="two">
        <v-list-item v-for="(file, index) in normalizedFiles" :key="index">
          <template v-slot:prepend>
            <v-avatar color="grey-lighten-4" rounded="0">
              <v-icon :icon="getFileIcon(file.filename)" color="red-darken-2" size="large"></v-icon>
            </v-avatar>
          </template>

          <v-list-item-title class="font-weight-bold">
            {{ file.originalName || file.filename }}
          </v-list-item-title>
          
          <v-list-item-subtitle>
            Pujat el: {{ formatDate(file.uploadDate) }}
          </v-list-item-subtitle>

          <template v-slot:append>
            <v-chip size="small" class="mr-2" color="primary" variant="outlined">
              {{ getFileExtension(file.filename) }}
            </v-chip>
            
            <!-- Botó per obrir el diàleg de selecció -->
            <v-btn v-if="getFileExtension(file.filename) === 'PDF'"
              icon="mdi-robot" variant="text" color="purple" title="Generar Resum IA"
              @click="openRoleDialog(file)">
            </v-btn>

            <!-- Botó Xat (NOU) -->
            <v-btn v-if="getFileExtension(file.filename) === 'PDF'"
              icon="mdi-chat-question-outline" variant="text" color="deep-purple" title="Xat amb el Document"
              @click="goToChat(file)">
            </v-btn>

            <v-btn :href="`http://localhost:3001/uploads/${file.filename}`" target="_blank" icon="mdi-open-in-new"
              variant="text" color="primary" title="Obrir document">
            </v-btn>
            <v-btn icon="mdi-download" variant="text" color="success" title="Descarregar document"
              @click="downloadFile(file.filename, file.originalName)">
            </v-btn>
            <v-btn icon="mdi-delete" variant="text" color="error" title="Eliminar document"
              @click="deleteFile(file.filename)">
            </v-btn>
          </template>
        </v-list-item>
      </v-list>
    </v-card>

    <v-row class="mt-6 mb-10" justify="center">
      <v-col cols="12" md="6" class="text-center">
        <v-btn 
          color="secondary" 
          size="large" 
          prepend-icon="mdi-format-list-bulleted"
          @click="goToList"
          block
        >
          Tornar a la llista d'estudiants
        </v-btn>
      </v-col>
    </v-row>

    <!-- DIÀLEG SELECCIÓ DE PERFIL -->
    <v-dialog v-model="showRoleDialog" max-width="500">
      <v-card>
        <v-card-title class="text-h5 bg-primary text-white">
          Escull el perfil
        </v-card-title>
        <v-card-text class="pt-4">
          <p class="mb-4">Quin tipus de resum necessites?</p>
          <v-row>
            <v-col cols="6">
              <v-btn block color="indigo-lighten-1" height="60" @click="selectRole('docent')">
                <v-icon start>mdi-school</v-icon> Docent
              </v-btn>
            </v-col>
            <v-col cols="6">
              <v-btn block color="teal-lighten-1" height="60" @click="selectRole('orientador')">
                <v-icon start>mdi-compass-outline</v-icon> Orientador
              </v-btn>
            </v-col>
          </v-row>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="grey" variant="text" @click="showRoleDialog = false">Cancel·lar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

  </v-container>
</template>

<script setup>
import { computed, onMounted, watch, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router'; // <--- AÑADIDO useRouter
import { useStudentStore } from '@/stores/studentStore';

const route = useRoute();
const router = useRouter(); // <--- Inicializamos router
const studentStore = useStudentStore();

// --- ESTAT PER AL DIÀLEG DE ROLS ---
const showRoleDialog = ref(false);
const selectedFileForSummary = ref(null);
let pollingInterval = null; // Per actualitzar l'estat del resum global

const openRoleDialog = (file) => {
  selectedFileForSummary.value = file;
  showRoleDialog.value = true;
};

const selectRole = (role) => {
  showRoleDialog.value = false;
  if (selectedFileForSummary.value) {
    goToSummary(selectedFileForSummary.value, role);
  }
};

// --- NUEVA FUNCIÓN PARA VOLVER ---
const goToList = () => {
  // Redirige a la ruta '/alumnos' que creamos en el paso anterior.
  // Si prefieres ir al menú de botones, cambia esto por '/dashboard'
  router.push('/alumnos');
};

// ... (Resto del código idéntico: student, normalizedFiles, helpers, etc.) ...

const student = computed(() => {
  return studentStore.students.find(s => s.hash_id === route.params.hash_id);
});

const normalizedFiles = computed(() => {
  const s = student.value;
  if (!s) return [];
  if (s.files && Array.isArray(s.files)) {
    return s.files;
  }
  if (s.filename) {
    let date = new Date();
    const parts = s.filename.split('_');
    if (parts.length >= 2) {
      const timestamp = parseInt(parts[1]);
      if (!isNaN(timestamp)) date = new Date(timestamp);
    }
    return [{
      filename: s.filename,
      originalName: 'Document PI (Versió anterior)',
      uploadDate: date,
      mimetype: 'application/pdf'
    }];
  }
  return [];
});

const getFileIcon = (filename) => {
  const ext = filename.split('.').pop().toLowerCase();
  if (ext === 'pdf') return 'mdi-file-pdf-box';
  if (['doc', 'docx'].includes(ext)) return 'mdi-file-word-box';
  if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) return 'mdi-file-image';
  return 'mdi-file-document-outline';
};

const getFileExtension = (filename) => filename.split('.').pop().toUpperCase();

const formatDate = (dateVal) => {
  if (!dateVal) return 'Data desconeguda';
  return new Date(dateVal).toLocaleString();
};

watch(normalizedFiles, (newFiles) => {
  console.log('🔄 VISTA ACTUALIZADA: La lista de documentos ha cambiado.', newFiles);
});

const goToSummary = (file, role = 'docent') => {
  // Redirigim a la nova pàgina de resum amb el mode seleccionat a la URL
  router.push({ 
    name: 'SummaryPage', 
    params: { filename: file.filename },
    query: { role: role } // Passem el rol com a paràmetre
  });
};

const goToChat = (file) => {
  router.push({ 
    name: 'ChatPage', 
    params: { filename: file.filename }
  });
};

const downloadFile = async (filename, originalName) => {
  try {
    const response = await fetch(`http://localhost:3001/uploads/${filename}`);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = originalName || filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error downloading file:', error);
  }
};

const generateGlobalSummary = async () => {
    try {
        // Actualització optimista
        if (!student.value.global_summary) student.value.global_summary = {};
        student.value.global_summary.estado = 'A LA CUA';
        
        const response = await fetch('http://localhost:3001/api/generate-global-summary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentHash: route.params.hash_id })
        });
        
        if (!response.ok) throw new Error('Error iniciant generació');
        
        // Iniciem polling per veure el progrés
        if (!pollingInterval) {
            pollingInterval = setInterval(async () => {
                await studentStore.fetchStudents(); // Refresquem dades
                const s = student.value;
                if (s && s.global_summary && (s.global_summary.estado === 'COMPLETAT' || s.global_summary.estado === 'ERROR')) {
                    clearInterval(pollingInterval);
                    pollingInterval = null;
                }
            }, 3000);
        }
    } catch (e) {
        console.error(e);
        alert("Error generant resum global");
    }
};

const deleteFile = async (filename) => {
  console.log(`🗑️ INICIO: Sol·licitant eliminar fitxer: ${filename}`);
  
  if (!confirm('Estàs segur que vols eliminar aquest fitxer?')) return;

  // Cridem a l'acció del STORE.
  // Aquesta acció ja s'encarrega d'agafar l'email de l'usuari, fer el DELETE,
  // registrar el log al servidor i actualitzar la llista d'estudiants.
  const success = await studentStore.deleteFile(route.params.hash_id, filename);

  if (success) {
    console.log('✅ OK: Fitxer esborrat i llista actualitzada.');
  } else {
    // L'error ja es mostra a la consola dins del store, però avisem a l'usuari
    alert("No s'ha pogut esborrar el fitxer. Revisa la consola o els permisos.");
  }
};

onMounted(async () => {
  if (studentStore.students.length === 0) {
    await studentStore.fetchStudents();
  }
});
</script>

<style scoped>
.font-mono {
  font-family: monospace;
}
.hover-card:hover {
  background-color: rgba(var(--v-theme-primary), 0.05);
}
</style>