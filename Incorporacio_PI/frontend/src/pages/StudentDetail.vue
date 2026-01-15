<template>
  <v-container class="fill-height align-start bg-grey-lighten-5" fluid>
    
    <v-btn 
      class="mb-4 text-none font-weight-bold" 
      variant="text" 
      prepend-icon="mdi-arrow-left" 
      @click="goToList"
      color="grey-darken-3"
    >
      Tornar al llistat
    </v-btn>

    <div v-if="studentStore.loading && !student" class="d-flex justify-center mt-10 w-100">
      <v-progress-circular indeterminate color="#D0021B" size="64"></v-progress-circular>
    </div>

    <v-row v-else-if="student">
      
      <v-col cols="12" md="8">
        <v-card class="pa-6 gencat-card h-100" elevation="0" rounded="lg">
          
          <v-card-title class="text-h5 font-weight-bold d-flex align-center px-0">
            <v-avatar color="grey-lighten-4" class="mr-4 border" size="80">
              <span class="text-h4 text-grey-darken-3 font-weight-bold d-flex align-center justify-center w-100 h-100" style="line-height: 1;">
                {{ student.visual_identity?.iniciales }}
              </span>
            </v-avatar>
            <div>
              <div class="text-grey-darken-3 font-weight-bold">Detall de l'Estudiant</div>
              <div class="text-caption text-grey-darken-1">ID: {{ student.hash_id }}</div>
            </div>
          </v-card-title>

          <v-divider class="my-4"></v-divider>

          <v-card-text class="px-0">
            <v-row>
              <v-col cols="12" sm="4">
                <v-list-item class="pa-0">
                  <template v-slot:prepend>
                    <v-icon icon="mdi-account-circle-outline" color="grey-darken-2" size="large"></v-icon>
                  </template>
                  <v-list-item-title class="text-caption font-weight-bold text-grey">INICIALS</v-list-item-title>
                  <v-list-item-subtitle class="text-body-1 text-black font-weight-medium">
                    {{ student.visual_identity?.iniciales }}
                  </v-list-item-subtitle>
                </v-list-item>
              </v-col>

              <v-col cols="12" sm="4">
                <v-list-item class="pa-0">
                  <template v-slot:prepend>
                    <v-icon icon="mdi-identifier" color="grey-darken-2" size="large"></v-icon>
                  </template>
                  <v-list-item-title class="text-caption font-weight-bold text-grey">SUFIX RALC</v-list-item-title>
                  <v-list-item-subtitle class="text-body-1 text-black font-weight-medium">
                    {{ student.visual_identity?.ralc_suffix }}
                  </v-list-item-subtitle>
                </v-list-item>
              </v-col>

              <v-col cols="12" sm="4">
                <v-list-item class="bg-grey-lighten-4 rounded border" lines="two">
                  <template v-slot:prepend>
                    <v-icon icon="mdi-school" color="grey-darken-3"></v-icon>
                  </template>
                  <v-list-item-title class="font-weight-bold text-grey-darken-3 text-body-2">
                    Centre Actual
                  </v-list-item-title>
                  <v-list-item-subtitle class="text-caption mt-1 text-black" style="white-space: normal;">
                    {{ currentSchoolName }}
                  </v-list-item-subtitle>
                  <template v-slot:append>
                    <v-btn 
                      icon="mdi-pencil" 
                      size="small" 
                      variant="text" 
                      color="#D0021B"
                      @click="openTransferDialog" 
                      title="Modificar Centre"
                    ></v-btn>
                  </template>
                </v-list-item>
              </v-col>

              <v-col cols="12">
                
                <v-alert 
                  v-if="!student.codi_centre"
                  color="orange-lighten-5"
                  icon="mdi-domain-off" 
                  variant="flat" 
                  density="compact"
                  class="mt-2 border text-orange-darken-4"
                  style="border-color: rgba(0,0,0,0.1) !important;"
                >
                  <div class="d-flex align-center justify-space-between w-100">
                    <span class="text-body-2 font-weight-bold">
                      Atenció: Aquest alumne no té centre assignat.
                    </span>
                  </div>
                </v-alert>

                <v-alert 
                  :color="student.has_file ? 'green-lighten-5' : 'orange-lighten-5'"
                  :icon="student.has_file ? 'mdi-check-circle' : 'mdi-alert-circle'" 
                  variant="flat" 
                  density="compact"
                  class="mt-2 border"
                  :class="student.has_file ? 'text-green-darken-4' : 'text-orange-darken-4'"
                  style="border-color: rgba(0,0,0,0.1) !important;"
                >
                  <span class="text-body-2 font-weight-bold">
                    {{ student.has_file ? "Pla Individual (PI) pujat correctament." : 'Pendent de pujar document PI.' }}
                  </span>
                </v-alert>

              </v-col>
            </v-row>

            <v-divider class="my-6"></v-divider>

            <div class="text-h6 mb-4 d-flex align-center text-grey-darken-3 font-weight-bold">
              <v-icon icon="mdi-history" class="mr-2" color="grey-darken-2"></v-icon> Historial de Centres
            </div>

            <div class="history-container bg-white border rounded pa-2">
              <v-timeline density="compact" side="end" align="start">
                <v-timeline-item dot-color="green-darken-3" size="small">
                  <div class="d-flex justify-space-between">
                    <div>
                      <div class="font-weight-bold text-green-darken-4">{{ currentSchoolName }}</div>
                      <div class="text-caption text-grey-darken-1">Centre Actual</div>
                    </div>
                    <div class="text-caption text-grey-darken-1">Des d'avui</div>
                  </div>
                </v-timeline-item>
                <v-timeline-item v-for="(hist, i) in student.school_history" :key="i" dot-color="grey-lighten-1" size="x-small">
                  <div class="d-flex justify-space-between">
                    <div>
                      <div class="font-weight-bold text-grey-darken-3">{{ getSchoolName(hist.codi_centre) }}</div>
                      <div class="text-caption text-grey">Centre Anterior</div>
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
      </v-col>

      <v-col cols="12" md="4">
        <div style="position: sticky; top: 20px; z-index: 1;">
          <v-card class="pa-6 gencat-card" elevation="0" rounded="lg">
            <v-card-title class="text-h6 d-flex align-center justify-space-between px-0">
              <div class="d-flex align-center text-grey-darken-3 font-weight-bold">
                  <v-icon icon="mdi-folder-open" class="mr-2" color="grey-darken-2"></v-icon>
                  Documents Adjunts
              </div>
            </v-card-title>
            
            <v-divider class="my-2"></v-divider>
            
            <div class="pa-4 bg-grey-lighten-5 rounded mb-4 border border-dashed">
              <v-file-input 
                  label="Pujar nou PI (PDF)" 
                  variant="outlined" 
                  density="compact"
                  accept=".pdf" 
                  prepend-icon=""
                  prepend-inner-icon="mdi-cloud-upload" 
                  hide-details="auto"
                  color="#D0021B"
                  base-color="grey-darken-1"
                  bg-color="white"
                  @update:model-value="handleUpload"
              ></v-file-input>
            </div>

            <div v-if="normalizedFiles.length === 0" class="text-center text-grey py-4">
              No hi ha documents adjunts.
            </div>

            <v-list lines="two" v-else class="pa-0" style="max-height: 60vh; overflow-y: auto;">
              <v-list-item v-for="(file, index) in normalizedFiles" :key="index" class="border-b">
                <template v-slot:prepend>
                  <v-avatar color="red-lighten-5" rounded="lg">
                    <v-icon :icon="getFileIcon(file.filename)" color="#D0021B" size="large"></v-icon>
                  </v-avatar>
                </template>

                <v-list-item-title class="font-weight-bold text-grey-darken-3">
                  {{ file.originalName || file.filename }}
                </v-list-item-title>
                <v-list-item-subtitle class="text-caption text-grey-darken-1">
                  Pujat el: {{ formatDate(file.uploadDate) }}
                </v-list-item-subtitle>

                <template v-slot:append>
                  <v-btn v-if="getFileExtension(file.filename) === 'PDF'"
                    icon="mdi-robot" variant="text" size="small" color="purple-darken-2" title="Generar Resum IA"
                    @click="goToSummary(file)">
                  </v-btn>
                  
                  <v-btn :href="`http://localhost:3001/uploads/${file.filename}`" target="_blank" icon="mdi-open-in-new"
                    variant="text" size="small" color="grey-darken-3" title="Obrir en nova pestanya">
                  </v-btn>
                  
                  <v-btn icon="mdi-download" variant="text" size="small" color="green-darken-3" title="Descarregar"
                    @click="downloadFile(file.filename, file.originalName)">
                  </v-btn>
                  
                  <v-btn icon="mdi-delete" variant="text" size="small" color="#D0021B" title="Eliminar"
                    @click="deleteFile(file.filename)">
                  </v-btn>
                </template>
              </v-list-item>
            </v-list>
          </v-card>
        </div>
      </v-col>
    </v-row>

    <v-dialog v-model="showTransferDialog" max-width="500px">
      <v-card class="gencat-card" rounded="lg">
        <v-card-title class="bg-grey-lighten-5 pa-4 border-b font-weight-bold text-grey-darken-3">
          Modificar Centre (Trasllat)
        </v-card-title>
        <v-card-text class="pa-6">
          <p class="text-body-2 text-grey-darken-1 mb-4">Selecciona el nou centre. L'actual es guardarà a l'historial.</p>
          <v-autocomplete 
            v-model="selectedNewSchool" 
            :items="schoolsList" 
            item-title="denominacio_completa"
            item-value="codi_centre" 
            label="Buscar nou centre..." 
            variant="outlined" 
            color="#D0021B"
            prepend-inner-icon="mdi-school"
            clearable
          ></v-autocomplete>
        </v-card-text>
        <v-card-actions class="pa-4 pt-0">
          <v-spacer></v-spacer>
          <v-btn color="grey-darken-1" variant="text" @click="showTransferDialog = false">Cancel·lar</v-btn>
          <v-btn color="#D0021B" class="text-white" variant="flat" :disabled="!selectedNewSchool" @click="openConfirmDialog">
            Guardar Canvi
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="showConfirmDialog" max-width="400px">
      <v-card class="gencat-card text-center pa-4" rounded="lg">
        <div class="mb-2">
            <v-icon icon="mdi-alert-circle-outline" size="50" color="orange-darken-3"></v-icon>
        </div>
        <h3 class="text-h6 font-weight-bold mb-2">Confirmar Trasllat</h3>
        <p class="text-body-2 text-grey-darken-1 mb-4">
          Estàs segur que vols canviar l'alumne al centre:<br>
          <strong class="text-black">{{ getSchoolName(selectedNewSchool) }}</strong>?
        </p>
        <div class="d-flex justify-center gap-2">
          <v-btn color="grey-darken-1" variant="text" @click="showConfirmDialog = false">No, revisar</v-btn>
          <v-btn color="#D0021B" class="text-white" variant="flat" @click="executeTransfer">Sí, estic segur</v-btn>
        </div>
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

// --- LÓGICA DE ARCHIVOS ---
const handleUpload = async (files) => {
    const file = Array.isArray(files) ? files[0] : files;
    if (file) {
        if (file.type !== 'application/pdf') {
            alert("Només s'accepten fitxers PDF!");
            return;
        }
        const success = await studentStore.uploadStudentPI(file, route.params.hash_id);
        if (success) {
            await studentStore.fetchStudents();
        } else {
            alert("Error al pujar el fitxer");
        }
    }
};

const goToSummary = (file) => {
  router.push({ name: 'SummaryPage', params: { filename: file.filename } });
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
    console.error('Error downloading:', error);
  }
};

const deleteFile = async (filename) => {
  if (!confirm('Estàs segur que vols eliminar aquest fitxer?')) return;
  const success = await studentStore.deleteFile(route.params.hash_id, filename);
  if (success) {
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
/* ESTILS GENCAT (Base neta i vora fina) */
.gencat-card {
  border: 1px solid rgba(0,0,0,0.12) !important;
  background-color: white;
}

/* Scroll personalitzat */
.history-container {
  max-height: 250px;
  overflow-y: auto;
  border-color: rgba(0,0,0,0.1) !important;
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

/* Tipografia de sistema */
.v-application {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
}
</style>