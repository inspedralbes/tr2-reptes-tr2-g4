<template>
  <v-container>
    <v-btn class="mb-4" variant="text" prepend-icon="mdi-arrow-left" @click="goToList">
      Tornar al llistat
    </v-btn>

    <div v-if="studentStore.loading && !student" class="d-flex justify-center mt-10">
      <v-progress-circular indeterminate color="primary" size="64"></v-progress-circular>
    </div>

    <v-card v-else-if="student" class="mx-auto pa-4" max-width="900" elevation="2">
      <v-card-title class="text-h5 font-weight-bold d-flex align-center">
        <v-avatar color="primary" class="mr-4" size="80">
          <span class="text-h4 text-white d-flex align-center justify-center w-100 h-100" style="line-height: 1;">
            {{ student.visual_identity?.iniciales }}
          </span>
        </v-avatar>
        <div>
          <div>Detall de l'Estudiant</div>
          <div class="text-caption text-grey">ID: {{ student.hash_id }}</div>
        </div>
      </v-card-title>

      <v-divider class="my-3"></v-divider>

      <v-card-text>
        <v-row>
          <v-col cols="12" md="4">
            <v-list-item>
              <template v-slot:prepend><v-icon icon="mdi-account-circle-outline" color="primary"></v-icon></template>
              <v-list-item-title>Inicials</v-list-item-title>
              <v-list-item-subtitle class="text-body-1">{{ student.visual_identity?.iniciales }}</v-list-item-subtitle>
            </v-list-item>
          </v-col>

          <v-col cols="12" md="4">
            <v-list-item>
              <template v-slot:prepend><v-icon icon="mdi-identifier" color="primary"></v-icon></template>
              <v-list-item-title>Sufix RALC</v-list-item-title>
              <v-list-item-subtitle class="text-body-1">{{ student.visual_identity?.ralc_suffix }}</v-list-item-subtitle>
            </v-list-item>
          </v-col>

          <v-col cols="12" md="4">
            <v-list-item class="bg-blue-lighten-5 rounded-lg border-thin">
              <template v-slot:prepend><v-icon icon="mdi-school" color="primary"></v-icon></template>
              <v-list-item-title class="font-weight-bold text-primary">Centre Actual</v-list-item-title>
              <v-list-item-subtitle class="text-body-2 mt-1" style="white-space: normal;">
                {{ currentSchoolName }}
              </v-list-item-subtitle>
              <template v-slot:append>
                <v-btn icon="mdi-pencil" size="small" variant="text" color="primary"
                  @click="openTransferDialog" title="Modificar Centre"></v-btn>
              </template>
            </v-list-item>
          </v-col>

          <v-col cols="12">
            <v-alert :color="student.has_file ? 'success' : 'warning'"
              :icon="student.has_file ? 'mdi-check-circle' : 'mdi-alert-circle'" variant="tonal" density="compact"
              class="mt-2">
              {{ student.has_file ? "Pla Individual (PI) pujat correctament." : 'Pendent de pujar document PI.' }}
            </v-alert>
          </v-col>
        </v-row>

        <v-divider class="my-6"></v-divider>

        <div class="text-h6 mb-4 d-flex align-center">
          <v-icon icon="mdi-history" class="mr-2"></v-icon> Historial de Centres
        </div>

        <div class="history-container">
          <v-timeline density="compact" side="end">
            <v-timeline-item dot-color="green" size="small">
              <div class="d-flex justify-space-between">
                <div>
                  <div class="font-weight-bold text-green">{{ currentSchoolName }}</div>
                  <div class="text-caption">Centre Actual</div>
                </div>
                <div class="text-caption text-grey">Des d'avui</div>
              </div>
            </v-timeline-item>
            <v-timeline-item v-for="(hist, i) in student.school_history" :key="i" dot-color="grey" size="x-small">
              <div class="d-flex justify-space-between">
                <div>
                  <div class="font-weight-bold">{{ getSchoolName(hist.codi_centre) }}</div>
                  <div class="text-caption">Centre Anterior</div>
                </div>
                <div class="text-caption text-grey">
                  Fins al: {{ new Date(hist.date_end).toLocaleDateString() }}
                </div>
              </div>
            </v-timeline-item>
          </v-timeline>
        </div>

      </v-card-text>
    </v-card>

    <v-card v-if="student" class="mx-auto mt-4 pa-4" max-width="900" elevation="2">
      <v-card-title class="text-h6 d-flex align-center justify-space-between">
        <div class="d-flex align-center">
            <v-icon icon="mdi-file-document-multiple-outline" class="mr-2" color="primary"></v-icon>
            Documents Adjunts
        </div>
      </v-card-title>
      
      <v-divider class="my-2"></v-divider>
      
      <div class="pa-2 bg-grey-lighten-5 rounded mb-4 border-dashed">
         <v-file-input 
            label="Pujar nou PI (PDF)" 
            variant="outlined" 
            density="compact"
            accept=".pdf" 
            prepend-icon="mdi-cloud-upload" 
            hide-details="auto"
            @update:model-value="handleUpload"
        ></v-file-input>
      </div>

      <div v-if="normalizedFiles.length === 0" class="text-center text-grey py-4">
        No hi ha documents adjunts.
      </div>

      <v-list lines="two" v-else>
        <v-list-item v-for="(file, index) in normalizedFiles" :key="index">
          <template v-slot:prepend>
            <v-avatar color="grey-lighten-4" rounded="0">
              <v-icon :icon="getFileIcon(file.filename)" color="red-darken-2" size="large"></v-icon>
            </v-avatar>
          </template>

          <v-list-item-title class="font-weight-bold">{{ file.originalName || file.filename }}</v-list-item-title>
          <v-list-item-subtitle>Pujat el: {{ formatDate(file.uploadDate) }}</v-list-item-subtitle>

          <template v-slot:append>
             <v-btn v-if="getFileExtension(file.filename) === 'PDF'"
              icon="mdi-robot" variant="text" color="purple" title="Generar Resum IA"
              @click="goToSummary(file)">
            </v-btn>
            
            <v-btn :href="`http://localhost:3001/uploads/${file.filename}`" target="_blank" icon="mdi-open-in-new"
              variant="text" color="primary" title="Obrir en nova pestanya">
            </v-btn>
            
            <v-btn icon="mdi-download" variant="text" color="success" title="Descarregar"
              @click="downloadFile(file.filename, file.originalName)">
            </v-btn>
            
            <v-btn icon="mdi-delete" variant="text" color="error" title="Eliminar"
              @click="deleteFile(file.filename)">
            </v-btn>
          </template>
        </v-list-item>
      </v-list>
    </v-card>

    <v-dialog v-model="showTransferDialog" max-width="500px">
      <v-card>
        <v-card-title>Modificar Centre (Trasllat)</v-card-title>
        <v-card-text>
          <p class="text-body-2 text-grey mb-4">Selecciona el nou centre. L'actual es guardarà a l'historial.</p>
          <v-autocomplete v-model="selectedNewSchool" :items="schoolsList" item-title="denominacio_completa"
            item-value="codi_centre" label="Buscar nou centre..." variant="outlined" prepend-inner-icon="mdi-school"
            clearable></v-autocomplete>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="grey" text @click="showTransferDialog = false">Cancel·lar</v-btn>
          <v-btn color="primary" :disabled="!selectedNewSchool" @click="openConfirmDialog">Guardar Canvi</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="showConfirmDialog" max-width="400px">
      <v-card>
        <v-card-title class="text-h6 bg-warning text-white">
          <v-icon icon="mdi-alert" color="white" class="mr-2"></v-icon>
          Confirmar Trasllat
        </v-card-title>
        <v-card-text class="pa-4 text-center">
          Estàs segur que vols canviar l'alumne al centre:<br>
          <strong>{{ getSchoolName(selectedNewSchool) }}</strong>?
        </v-card-text>
        <v-card-actions class="justify-center pb-4">
          <v-btn color="grey-darken-1" variant="text" @click="showConfirmDialog = false">No, revisar</v-btn>
          <v-btn color="warning" variant="elevated" @click="executeTransfer">Sí, estic segur</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useStudentStore } from '@/stores/studentStore';

const route = useRoute();
const router = useRouter();
const studentStore = useStudentStore();

const schoolsList = ref([]);
const showTransferDialog = ref(false);
const showConfirmDialog = ref(false);
const selectedNewSchool = ref(null);

const goToList = () => {
  router.push('/alumnos');
};

const student = computed(() => {
  return studentStore.students.find(s => s.hash_id === route.params.hash_id);
});

// --- HELPERS VISUALES ---
const getSchoolName = (code) => {
  if(!code) return '';
  const found = schoolsList.value.find(s => s.codi_centre === code);
  return found ? found.denominacio_completa : `Codi: ${code}`;
};

const currentSchoolName = computed(() => {
  if (!student.value || !student.value.codi_centre) return 'No especificat';
  return getSchoolName(student.value.codi_centre);
});

const getFileIcon = (filename) => {
  const ext = filename.split('.').pop().toLowerCase();
  if (ext === 'pdf') return 'mdi-file-pdf-box';
  return 'mdi-file-document-outline';
};

const getFileExtension = (filename) => filename.split('.').pop().toUpperCase();

const formatDate = (d) => d ? new Date(d).toLocaleString() : '-';

const normalizedFiles = computed(() => {
  const s = student.value;
  if (!s) return [];
  if (s.files && Array.isArray(s.files)) return s.files;
  return [];
});

// --- LÓGICA DE TRANSFERENCIA ---
const openTransferDialog = () => {
  selectedNewSchool.value = student.value.codi_centre;
  showTransferDialog.value = true;
};

const openConfirmDialog = () => {
  showConfirmDialog.value = true;
};

const executeTransfer = async () => {
  if (!selectedNewSchool.value) return;
  try {
    const response = await fetch(`http://localhost:3001/api/students/${student.value.hash_id}/transfer`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_center_id: selectedNewSchool.value })
    });

    if (response.ok) {
      console.log("✅ Trasllat guardat");
      await studentStore.fetchStudents();
      showConfirmDialog.value = false;
      showTransferDialog.value = false;
    } else {
      const errorData = await response.json();
      alert(`Error: ${errorData.error || 'Fallada en el trasllat'}`);
      showConfirmDialog.value = false;
    }
  } catch (e) {
    alert("Error de connexió");
  }
};

// --- LÓGICA DE ARCHIVOS (RESTAURADA) ---

// 1. Subir archivo
const handleUpload = async (files) => {
    const file = Array.isArray(files) ? files[0] : files;
    if (file) {
        if (file.type !== 'application/pdf') {
            alert("Només s'accepten fitxers PDF!");
            return;
        }
        const success = await studentStore.uploadStudentPI(file, route.params.hash_id);
        if (success) {
            console.log("Archivo subido correctamente");
            // Recargamos estudiante para ver el nuevo fichero
            await studentStore.fetchStudents();
        } else {
            alert("Error al pujar el fitxer");
        }
    }
};

// 2. Ir a resumen IA
const goToSummary = (file) => {
  router.push({ name: 'SummaryPage', params: { filename: file.filename } });
};

// 3. Descargar
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
    console.error('Error downloading:', error);
  }
};

// 4. Eliminar
const deleteFile = async (filename) => {
  if (!confirm('Estàs segur que vols eliminar aquest fitxer?')) return;
  const success = await studentStore.deleteFile(route.params.hash_id, filename);
  if (success) {
    console.log('Fitxer esborrat');
    await studentStore.fetchStudents();
  } else {
    alert("No s'ha pogut esborrar");
  }
};

onMounted(async () => {
  if (studentStore.students.length === 0) {
    await studentStore.fetchStudents();
  }
  try {
    const res = await fetch('http://localhost:3001/api/centros');
    if (res.ok) schoolsList.value = await res.json();
  } catch (e) {
    console.error("Error centres:", e);
  }
});
</script>

<style scoped>
.font-mono {
  font-family: monospace;
}

.history-container {
  max-height: 250px;
  overflow-y: auto;
  padding-right: 10px;
  border: 1px solid #eeeeee;
  border-radius: 8px;
}

.history-container::-webkit-scrollbar {
  width: 6px;
}
.history-container::-webkit-scrollbar-track {
  background: #f1f1f1; 
}
.history-container::-webkit-scrollbar-thumb {
  background: #bdbdbd; 
  border-radius: 4px;
}
</style>