<template>
  <v-container class="fill-height align-start bg-gencat-background pa-6" fluid>

    <div class="w-100 mb-6 d-flex align-center justify-space-between">
      <v-btn class="text-none font-weight-regular px-0 text-grey-darken-3 hover-underline" variant="text"
        prepend-icon="mdi-arrow-left" @click="goToList" :ripple="false">
        Tornar al llistat d'alumnes
      </v-btn>
    </div>

    <div v-if="studentStore.loading && !student" class="d-flex justify-center mt-10 w-100">
      <v-progress-circular indeterminate color="#D0021B" size="48" width="4"></v-progress-circular>
    </div>

    <v-row v-else-if="student">

      <v-col cols="12" md="7">
        <v-card class="gencat-card h-100" elevation="0" rounded="sm">

          <div class="d-flex flex-column flex-sm-row align-start align-sm-center pa-6 pb-4">
            <v-avatar color="grey-lighten-4" class="mr-5 border-subtle" rounded="0" size="80">
              <span
                class="text-h4 text-gencat-red font-weight-black d-flex align-center justify-center w-100 h-100 font-secondary">
                {{ student.visual_identity?.iniciales }}
              </span>
            </v-avatar>
            <div class="flex-grow-1">
              <div class="text-overline text-grey-darken-1 mb-0">Fitxa de l'alumne</div>
              <h1 class="text-h5 text-grey-darken-4 font-weight-bold mb-1">
                Detall de l'expedient
              </h1>
              <div class="d-flex align-center">
                <v-chip size="small" variant="flat" color="grey-lighten-4"
                  class="text-grey-darken-3 font-weight-medium rounded-sm border-subtle mr-2">
                  ID: {{ student.hash_id }}
                </v-chip>
                <v-chip size="small" variant="flat" :color="student.has_file ? 'green-lighten-5' : 'orange-lighten-5'"
                  class="font-weight-medium rounded-sm border-subtle"
                  :class="student.has_file ? 'text-green-darken-3' : 'text-orange-darken-3'">
                  <v-icon start size="small"
                    :icon="student.has_file ? 'mdi-check-circle' : 'mdi-alert-circle'"></v-icon>
                  {{ student.has_file ? "PI Actiu" : "PI Pendent" }}
                </v-chip>
              </div>
            </div>
          </div>

          <v-divider class="mx-6 border-subtle"></v-divider>

          <v-card-text class="pa-6">
            <v-row dense class="mb-6">
              <v-col cols="12" sm="4">
                <div class="data-box pa-3 h-100">
                  <div class="text-caption text-grey-darken-1 text-uppercase font-weight-bold mb-1">Inicials</div>
                  <div class="text-body-1 font-weight-medium text-grey-darken-4">{{ student.visual_identity?.iniciales
                  }}</div>
                </div>
              </v-col>

              <v-col cols="12" sm="4">
                <div class="data-box pa-3 h-100">
                  <div class="text-caption text-grey-darken-1 text-uppercase font-weight-bold mb-1">Sufix RALC</div>
                  <div class="text-body-1 font-weight-medium text-grey-darken-4">{{ student.visual_identity?.ralc_suffix
                  }}</div>
                </div>
              </v-col>

              <v-col cols="12" sm="4">
                <div class="data-box active pa-3 h-100 d-flex flex-column justify-center relative">
                  <div class="d-flex justify-space-between align-start">
                    <div>
                      <div class="text-caption text-gencat-red text-uppercase font-weight-bold mb-1">Centre Actual</div>
                      <div class="text-body-2 font-weight-bold text-grey-darken-4" style="line-height: 1.3;">
                        {{ currentSchoolName }}
                      </div>
                    </div>
                    <v-btn icon="mdi-pencil" size="x-small" variant="text" color="grey-darken-1"
                      @click="openTransferDialog" title="Modificar Centre"></v-btn>
                  </div>
                </div>
              </v-col>
            </v-row>

            <v-alert v-if="!student.codi_centre" border="start" border-color="warning" color="orange-lighten-5"
              variant="flat" density="compact" class="mb-6 text-body-2 text-grey-darken-3">
              <template v-slot:prepend>
                <v-icon icon="mdi-alert" color="warning" class="mr-2"></v-icon>
              </template>
              <strong>Atenció:</strong> Aquest alumne no té centre assignat actualment.
            </v-alert>

            <div class="d-flex align-center mb-4 mt-8">
              <h3 class="text-h6 font-weight-bold text-grey-darken-3 text-no-wrap">Traçabilitat i Històric</h3>
              <v-divider class="ml-4 border-subtle flex-grow-1"></v-divider>
            </div>

            <div class="history-container pr-2">
              <v-timeline density="compact" side="end" align="start" line-color="grey-lighten-2" truncate-line="start">

                <v-timeline-item dot-color="#D0021B" size="x-small" fill-dot>
                  <template v-slot:icon>
                    <div class="timeline-dot-inner"></div>
                  </template>

                  <div class="ml-4 mb-6">
                    <div class="d-flex align-center mb-1">
                      <span class="text-caption font-weight-bold text-gencat-red text-uppercase mr-2">
                        Curs Actual
                      </span>
                      <span class="status-badge active">ACTIU</span>
                    </div>

                    <div class="gencat-timeline-card pa-4 status-border-left red-border">
                      <div class="text-subtitle-1 font-weight-bold text-grey-darken-4 mb-1">
                        {{ currentSchoolName }}
                      </div>
                      <div class="text-caption text-grey-darken-1 mb-3">
                        <v-icon icon="mdi-calendar-range" size="small" class="mr-1"></v-icon>
                        Data d'inici: {{ (student.date_start || student.start_date) ? formatDate(student.date_start ||
                          student.start_date) : 'Desconeguda' }}
                      </div>

                      <div v-if="getFilesForCurrentCenter().length > 0" class="mt-3 pt-3 border-top-dashed">
                        <div class="text-caption font-weight-bold text-green-darken-3 mb-2 d-flex align-center">
                          <v-icon icon="mdi-check-circle-outline" size="small" class="mr-1"></v-icon>
                          Documentació vigent:
                        </div>

                        <v-list class="bg-transparent pa-0">
                          <v-list-item v-for="file in getFilesForCurrentCenter()" :key="file.filename" rounded="sm"
                            density="compact" class="mb-1 bg-white border-subtle hover-shadow" style="min-height: 48px;"
                            @click="downloadFile(file.filename, file.originalName)">
                            <template v-slot:prepend>
                              <v-icon :icon="isLatest(file.filename) ? 'mdi-star' : 'mdi-file-pdf-box'"
                                :color="isLatest(file.filename) ? '#D0021B' : 'grey-darken-2'"></v-icon>
                            </template>

                            <v-list-item-title class="text-body-2 text-grey-darken-3 font-weight-medium">
                              {{ file.originalName }}
                            </v-list-item-title>
                            <v-list-item-subtitle class="text-caption">
                              {{ formatDate(file.uploadDate) }}
                              <span v-if="isLatest(file.filename)" class="text-gencat-red font-weight-bold ml-1">—
                                Versió més
                                recent</span>
                            </v-list-item-subtitle>
                          </v-list-item>
                        </v-list>
                      </div>

                      <div v-else-if="student.has_file"
                        class="mt-3 text-caption text-blue-darken-3 bg-blue-lighten-5 pa-2 rounded-sm d-flex align-center">
                        <v-icon icon="mdi-information-outline" size="small" class="mr-2"></v-icon>
                        PI vigent provinent d'històric o trasllat.
                      </div>
                      <div v-else
                        class="mt-3 text-caption text-orange-darken-3 bg-orange-lighten-5 pa-2 rounded-sm d-flex align-center">
                        <v-icon icon="mdi-alert-circle-outline" size="small" class="mr-2"></v-icon>
                        Pendent de documentació per aquest curs.
                      </div>
                    </div>
                  </div>
                </v-timeline-item>

                <v-timeline-item v-for="(hist, i) in student.school_history" :key="i"
                  :dot-color="getFilesByHistory(hist).length > 0 ? 'green-darken-1' : 'grey-lighten-1'" size="small"
                  :icon="getFilesByHistory(hist).length > 0 ? 'mdi-file-check' : 'mdi-history'" fill-dot>
                  <div class="ml-4 mb-4 transition-swing">

                    <div class="gencat-timeline-card pa-3 bg-grey-lighten-5 status-border-left"
                      :class="getFilesByHistory(hist).length > 0 ? 'green-border' : 'grey-border'">
                      <div class="d-flex justify-space-between align-start">
                        <div class="text-body-2 font-weight-bold text-grey-darken-3">
                          {{ getSchoolName(hist.codi_centre) }}
                        </div>

                        <v-chip size="x-small" variant="flat"
                          :color="getFilesByHistory(hist).length > 0 ? 'green-lighten-4' : 'grey-lighten-3'"
                          class="font-weight-bold"
                          :class="getFilesByHistory(hist).length > 0 ? 'text-green-darken-4' : 'text-grey-darken-1'">
                          {{ getFilesByHistory(hist).length > 0 ? 'PI ENTREGAT' : 'SENSE PI' }}
                        </v-chip>
                      </div>

                      <div class="text-caption text-grey-darken-1 mt-1 font-mono mb-2">
                        {{ (hist.date_start || hist.start_date) ? formatDate(hist.date_start || hist.start_date) : '...'
                        }}
                        —
                        {{ (hist.date_end || hist.end_date) ? formatDate(hist.date_end || hist.end_date) : '...' }}
                      </div>

                      <v-divider class="border-subtle mb-2"></v-divider>

                      <div v-if="getFilesByHistory(hist).length > 0">
                        <div class="text-caption text-green-darken-2 font-weight-bold mb-1">Arxius adjunts:</div>
                        <div class="d-flex flex-wrap gap-1">
                          <v-chip v-for="file in getFilesByHistory(hist)" :key="file.filename" size="small"
                            variant="tonal" color="green-darken-3" class="bg-white border-green-subtle"
                            @click="downloadFile(file.filename, file.originalName)" prepend-icon="mdi-paperclip">
                            <span class="text-truncate" style="max-width: 180px;">{{ file.originalName }}</span>
                          </v-chip>
                        </div>
                      </div>

                      <div v-else class="d-flex align-center text-caption text-grey-darken-1 font-italic">
                        <v-icon icon="mdi-close" size="x-small" class="mr-1"></v-icon> No consta documentació d'aquest
                        període.
                      </div>
                    </div>
                  </div>
                </v-timeline-item>
              </v-timeline>

              <div v-if="(!student.school_history || student.school_history.length === 0)"
                class="text-center py-6 text-grey-lighten-1">
                <div class="text-caption font-italic">No hi ha historial previ disponible.</div>
              </div>

            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="5">
        <div class="sticky-top-20">
          <v-card class="gencat-card" elevation="0" rounded="sm">
            <v-card-title class="pa-4 bg-grey-lighten-4 border-bottom-subtle">
              <div class="text-subtitle-1 font-weight-bold text-grey-darken-3 d-flex align-center">
                <v-icon icon="mdi-folder-open-outline" class="mr-2 text-grey-darken-2"></v-icon>
                Gestió Documental
              </div>
            </v-card-title>

            <v-card-text class="pa-4">
              <div class="upload-zone mb-6">
                <v-file-input label="Adjuntar nou PI (PDF)" variant="plain" density="compact" accept=".pdf"
                  prepend-icon="" prepend-inner-icon="mdi-cloud-upload-outline" hide-details="auto"
                  class="file-input-custom" @update:model-value="handleUpload"></v-file-input>
              </div>

              <div v-if="normalizedFiles.length === 0"
                class="empty-state text-center py-8 border rounded-sm bg-grey-lighten-5">
                <v-icon icon="mdi-file-document-outline" size="large" color="grey-lighten-1" class="mb-2"></v-icon>
                <div class="text-body-2 text-grey">No hi ha documents adjunts.</div>
              </div>

              <div v-else class="file-list-container">
                <div class="text-caption font-weight-bold text-grey-darken-2 mb-2 px-1">Llistat complet</div>
                <v-list lines="two" class="pa-0">
                  <v-list-item v-for="(file, index) in normalizedFiles" :key="index"
                    class="file-item border-subtle mb-2 rounded-sm pa-2 pr-1">
                    <template v-slot:prepend>
                      <div
                        class="file-icon-box bg-red-lighten-5 text-gencat-red rounded-sm d-flex align-center justify-center mr-3">
                        <span class="font-weight-bold text-caption">PDF</span>
                      </div>
                    </template>

                    <v-list-item-title class="font-weight-bold text-body-2 text-grey-darken-3 text-truncate"
                      :title="file.originalName">
                      {{ file.originalName || file.filename }}
                    </v-list-item-title>
                    <v-list-item-subtitle class="text-caption text-grey-darken-1">
                      {{ formatDate(file.uploadDate) }}
                    </v-list-item-subtitle>

                    <template v-slot:append>
                      <div class="d-flex align-center">
                        <v-btn :href="`${API_URL}/uploads/${file.filename}`" target="_blank" icon="mdi-open-in-new"
                          variant="text" density="comfortable" size="small" color="blue-darken-3"
                          title="Obrir en nova pestanya"></v-btn>

                        <v-btn v-if="getFileExtension(file.filename) === 'PDF'" icon="mdi-robot-outline" variant="text"
                          density="comfortable" size="small" color="purple-darken-2" title="Resum IA"
                          @click="goToSummary(file)"></v-btn>

                        <v-btn icon="mdi-download-outline" variant="text" density="comfortable" size="small"
                          color="grey-darken-3" title="Descarregar"
                          @click="downloadFile(file.filename, file.originalName)"></v-btn>

                        <v-btn icon="mdi-trash-can-outline" variant="text" density="comfortable" size="small"
                          color="#D0021B" title="Eliminar" @click="deleteFile(file.filename)"></v-btn>
                      </div>
                    </template>
                  </v-list-item>
                </v-list>
              </div>
            </v-card-text>
          </v-card>
        </div>
      </v-col>
    </v-row>

    <v-dialog v-model="showTransferDialog" max-width="500px">
      <v-card class="gencat-card" rounded="sm">
        <v-card-title
          class="bg-grey-lighten-4 pa-4 border-bottom-subtle text-body-1 font-weight-bold text-grey-darken-3">
          Canvi de Centre / Historial
        </v-card-title>
        <v-card-text class="pa-6">
          <p class="text-body-2 text-grey-darken-1 mb-4">Selecciona el nou centre i defineix el període d'assignació.
          </p>
          <v-autocomplete v-model="selectedNewSchool" :items="schoolsList" item-title="denominacio_completa"
            item-value="codi_centre" label="Buscar centre educatiu" variant="outlined" density="compact" color="#D0021B"
            hide-details="auto" class="mb-4"></v-autocomplete>
          <v-row dense>
            <v-col cols="12" sm="6">
              <v-text-field v-model="transferStartDate" label="Data d'inici" type="date" variant="outlined"
                density="compact" color="#D0021B"></v-text-field>
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field v-model="transferEndDate" label="Data de fi (Opcional)" type="date" variant="outlined"
                density="compact" color="#D0021B"></v-text-field>
            </v-col>
          </v-row>
        </v-card-text>
        <v-divider></v-divider>
        
        <v-card-actions class="pa-4 bg-grey-lighten-5">
          <v-spacer></v-spacer>
          <v-btn color="grey-darken-3" variant="text" class="text-none font-weight-medium"
            @click="showTransferDialog = false">Cancel·lar</v-btn>
            
          <v-btn 
            color="#D0021B" 
            class="text-none font-weight-bold px-4" 
            variant="flat" 
            rounded="sm"
            :disabled="!selectedNewSchool || !transferStartDate" 
            @click="openConfirmDialog">
            Guardar Canvi
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="showConfirmDialog" max-width="400px" persistent>
      <v-card class="gencat-card text-center pa-6" rounded="sm">
        <div class="mb-4 d-flex justify-center">
          <div class="pa-3 bg-red-lighten-5 rounded-circle">
            <v-icon icon="mdi-alert-outline" size="32" color="#D0021B"></v-icon>
          </div>
        </div>
        <h3 class="text-h6 font-weight-bold text-grey-darken-3 mb-2">Confirmar Trasllat</h3>
        <p class="text-body-2 text-grey-darken-1 mb-6">
          Estàs a punt d'assignar l'alumne a:<br>
          <strong class="text-grey-darken-4">{{ getSchoolName(selectedNewSchool) }}</strong>
        </p>
        
        <div class="d-flex flex-column ga-2">
          <v-btn 
            color="#D0021B" 
            class="text-none font-weight-bold w-100" 
            variant="flat" 
            rounded="sm" 
            size="large"
            elevation="2"
            @click="executeTransfer">
            Confirmar canvi
          </v-btn>
          
          <v-btn 
            color="grey-darken-1" 
            variant="text" 
            class="text-none w-100"
            @click="cancelConfirm">
            Cancel·lar
          </v-btn>
        </div>
      </v-card>
    </v-dialog>

  </v-container>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useStudentStore } from '@/stores/studentStore';

// --- LOGIC SECTION ---
const route = useRoute();
const router = useRouter();
const studentStore = useStudentStore();

const schoolsList = ref([]);
const showTransferDialog = ref(false);
const showConfirmDialog = ref(false);
const selectedNewSchool = ref(null);
const transferStartDate = ref('');
const transferEndDate = ref('');

// 1. DEFINIMOS LA URL BASE CORRECTA
// Esta variable también estará disponible en el template para el botón :href
const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:3001');

const currentCenterFiles = computed(() => getFilesForCurrentCenter());

const getFilesForCurrentCenter = () => {
  if (!student.value || !normalizedFiles.value.length) return [];
  const currentCode = student.value.codi_centre;
  const startDateStr = student.value.date_start || student.value.start_date;
  if (!startDateStr) return normalizedFiles.value.filter(f => f.codi_centre === currentCode);
  const startMs = new Date(startDateStr).setHours(0, 0, 0, 0);
  return normalizedFiles.value.filter(file => {
    if (file.codi_centre && file.codi_centre !== currentCode) return false;
    if (!file.uploadDate) return false;
    const uploadMs = new Date(file.uploadDate).getTime();
    if (file.codi_centre === currentCode) return true;
    return uploadMs >= startMs;
  });
};

const getFilesByHistory = (historyItem) => {
  if (!normalizedFiles.value.length) return [];
  const currentFilenames = currentCenterFiles.value.map(f => f.filename);
  const histCode = historyItem.codi_centre;
  const startStr = historyItem.date_start || historyItem.start_date;
  const endStr = historyItem.date_end || historyItem.end_date;
  if (!startStr) return [];
  const startMs = new Date(startStr).setHours(0, 0, 0, 0);
  const endMs = endStr ? new Date(endStr).setHours(23, 59, 59, 999) : new Date().getTime();
  return normalizedFiles.value.filter(file => {
    if (currentFilenames.includes(file.filename)) return false;
    if (file.codi_centre) return file.codi_centre === histCode;
    if (!file.uploadDate) return false;
    const uploadMs = new Date(file.uploadDate).getTime();
    return uploadMs >= startMs && uploadMs <= endMs;
  });
};

const goToList = () => router.push('/alumnes');

const student = computed(() => studentStore.students.find(s => s.hash_id === route.params.hash_id));

const getSchoolName = (code) => {
  if (!code) return '';
  const found = schoolsList.value.find(s => s.codi_centre === code);
  return found ? found.denominacio_completa : `Codi: ${code}`;
};

const currentSchoolName = computed(() => {
  if (!student.value || !student.value.codi_centre) return 'Sense assignació';
  return getSchoolName(student.value.codi_centre);
});

const getFileExtension = (filename) => filename.split('.').pop().toUpperCase();

const formatDate = (d) => d ? new Date(d).toLocaleDateString('ca-ES') : '-';

const latestFile = computed(() => {
  if (!normalizedFiles.value.length) return null;
  return [...normalizedFiles.value].sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate))[0];
});

const isLatest = (filename) => latestFile.value && latestFile.value.filename === filename;

const normalizedFiles = computed(() => {
  const s = student.value;
  if (!s) return [];
  return Array.isArray(s.files) ? s.files : [];
});

const openTransferDialog = () => {
  selectedNewSchool.value = student.value.codi_centre;
  transferStartDate.value = new Date().toISOString().split('T')[0];
  transferEndDate.value = '';
  showTransferDialog.value = true;
};

const openConfirmDialog = () => {
  showTransferDialog.value = false;
  // Un pequeño timeout ayuda a que la animación se vea fluida
  setTimeout(() => {
    showConfirmDialog.value = true;
  }, 100);
};

// NUEVO: Si cancelan la confirmación, volvemos a abrir el formulario anterior para no perder los datos
const cancelConfirm = () => {
  showConfirmDialog.value = false;
  setTimeout(() => {
    showTransferDialog.value = true;
  }, 100);
};

const executeTransfer = async () => {
  if (!selectedNewSchool.value) return;
  const currentUserEmail = localStorage.getItem('userEmail') || 'Usuari';
  try {
    // 2. CORREGIDO: Usamos API_URL
    const response = await fetch(`${API_URL}/api/students/${student.value.hash_id}/transfer`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        new_center_id: selectedNewSchool.value,
        start_date: transferStartDate.value,
        end_date: transferEndDate.value || null,
        userEmail: currentUserEmail
      })
    });
    if (response.ok) {
      await studentStore.fetchStudents();
      showConfirmDialog.value = false;
      showTransferDialog.value = false;
    } else {
      const errorData = await response.json();
      alert(`Error: ${errorData.error || 'Fallada en el trasllat'}`);
      showConfirmDialog.value = false;
    }
  } catch (e) { console.error(e); alert("Error de connexió"); }
};

const handleUpload = async (files) => {
  const file = Array.isArray(files) ? files[0] : files;
  if (file) {
    if (file.type !== 'application/pdf') { alert("Només s'accepten fitxers PDF!"); return; }
    const success = await studentStore.uploadStudentPI(file, route.params.hash_id);
    if (success) await studentStore.fetchStudents();
    else alert("Error al pujar el fitxer");
  }
};

const goToSummary = (file) => router.push({ name: 'SummaryPage', params: { filename: file.filename } });

const downloadFile = async (filename, originalName) => {
  try {
    // 3. CORREGIDO: Usamos API_URL
    const response = await fetch(`${API_URL}/uploads/${filename}`);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = originalName || filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) { console.error('Error downloading:', error); }
};

const deleteFile = async (filename) => {
  if (!confirm('Estàs segur que vols eliminar aquest fitxer?')) return;
  const success = await studentStore.deleteFile(route.params.hash_id, filename);
  if (success) await studentStore.fetchStudents();
  else alert("No s'ha pogut esborrar");
};

onMounted(async () => {
  if (studentStore.students.length === 0) await studentStore.fetchStudents();
  try {
    // 4. CORREGIDO: Usamos API_URL
    const res = await fetch(`${API_URL}/api/centros`);
    if (res.ok) schoolsList.value = await res.json();
  } catch (e) { console.error("Error centres:", e); }
});
</script>

<style scoped>
/* --- Corporate Colors --- */
.text-gencat-red {
  color: #C00021 !important;
}

.bg-gencat-background {
  background-color: #F5F5F7 !important;
}

/* --- General Card Styling --- */
.gencat-card {
  border: 1px solid #E0E0E0 !important;
  background-color: white;
  transition: all 0.2s ease;
}

.border-subtle {
  border-color: #E0E0E0 !important;
}

.border-green-subtle {
  border-color: #A5D6A7 !important;
}

.border-bottom-subtle {
  border-bottom: 1px solid #E0E0E0 !important;
}

/* --- Data Boxes --- */
.data-box {
  background-color: #FAFAFA;
  border: 1px solid #EEEEEE;
  border-radius: 4px;
}

.data-box.active {
  background-color: white;
  border-color: #E0E0E0;
  border-left: 3px solid #C00021;
}

/* --- Timeline Styling --- */
.history-container {
  max-height: 500px;
  overflow-y: auto;
}

/* Custom Scrollbar */
.history-container::-webkit-scrollbar,
.v-list::-webkit-scrollbar {
  width: 4px;
}

.history-container::-webkit-scrollbar-track,
.v-list::-webkit-scrollbar-track {
  background: transparent;
}

.history-container::-webkit-scrollbar-thumb,
.v-list::-webkit-scrollbar-thumb {
  background: #D6D6D6;
  border-radius: 4px;
}

.timeline-dot-inner {
  width: 12px;
  height: 12px;
  background-color: #D0021B;
  border-radius: 50%;
  border: 2px solid white;
  box-shadow: 0 0 0 1px #D0021B;
}

/* Tarjeta del timeline con indicador lateral */
.gencat-timeline-card {
  border: 1px solid #EEEEEE;
  border-radius: 4px;
  background-color: white;
  position: relative;
  overflow: hidden;
}

/* Indicador lateral izquierdo */
.status-border-left {
  border-left-width: 4px !important;
  border-left-style: solid !important;
}

.red-border {
  border-left-color: #D0021B !important;
}

.green-border {
  border-left-color: #43A047 !important;
}

.grey-border {
  border-left-color: #BDBDBD !important;
}

.border-top-dashed {
  border-top: 1px dashed #E0E0E0;
}

.status-badge {
  font-size: 0.7rem;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  background-color: #E0E0E0;
  color: #616161;
}

.status-badge.active {
  background-color: #D0021B;
  color: white;
}

/* --- File Manager --- */
.sticky-top-20 {
  position: sticky;
  top: 20px;
  z-index: 1;
}

.upload-zone :deep(.v-field) {
  border: 1px dashed #BDBDBD !important;
  border-radius: 6px;
  background-color: #FAFAFA;
  transition: background 0.2s;
}

.upload-zone :deep(.v-field:hover) {
  background-color: #F5F5F5;
}

.file-icon-box {
  width: 32px;
  height: 32px;
}

.file-item {
  transition: background-color 0.1s;
  cursor: pointer;
}

.file-item:hover {
  background-color: #FAFAFA;
}

/* --- Typography Helpers --- */
.hover-underline:hover {
  text-decoration: underline;
}

.font-secondary {
  font-family: 'Georgia', serif;
}

.hover-shadow:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.text-no-wrap {
  white-space: nowrap !important;
}

/* --- Dialog Actions --- */
.gap-2 {
  gap: 8px;
}

/* Global Font Override */
:deep(.v-application) {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif !important;
}
</style>