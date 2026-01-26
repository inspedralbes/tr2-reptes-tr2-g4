<template>
  <v-container class="fill-height align-start bg-gencat-background pa-6" fluid>

    <div class="w-100 mb-6 d-flex align-center justify-space-between">
      <v-btn 
        class="text-none font-weight-regular px-0 text-grey-darken-3 hover-underline" 
        variant="text" 
        prepend-icon="mdi-arrow-left" 
        @click="goToList"
        :ripple="false"
      >
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
              <span class="text-h4 text-gencat-red font-weight-black d-flex align-center justify-center w-100 h-100 font-secondary">
                {{ student.visual_identity?.iniciales }}
              </span>
            </v-avatar>
            <div class="flex-grow-1">
              <div class="text-overline text-grey-darken-1 mb-0">Fitxa de l'alumne</div>
              <h1 class="text-h5 text-grey-darken-4 font-weight-bold mb-1">
                Detall de l'expedient
              </h1>
              <div class="d-flex align-center">
                <v-chip size="small" variant="flat" color="grey-lighten-4" class="text-grey-darken-3 font-weight-medium rounded-sm border-subtle mr-2">
                  ID: {{ student.hash_id }}
                </v-chip>
                <v-chip size="small" variant="flat" :color="student.has_file ? 'green-lighten-5' : 'orange-lighten-5'" class="font-weight-medium rounded-sm border-subtle" :class="student.has_file ? 'text-green-darken-3' : 'text-orange-darken-3'">
                  <v-icon start size="small" :icon="student.has_file ? 'mdi-check-circle' : 'mdi-alert-circle'"></v-icon>
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
                  <div class="text-body-1 font-weight-medium text-grey-darken-4">{{ student.visual_identity?.iniciales }}</div>
                </div>
              </v-col>

              <v-col cols="12" sm="4">
                <div class="data-box pa-3 h-100">
                  <div class="text-caption text-grey-darken-1 text-uppercase font-weight-bold mb-1">Sufix RALC</div>
                  <div class="text-body-1 font-weight-medium text-grey-darken-4">{{ student.visual_identity?.ralc_suffix }}</div>
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
                    <v-btn icon="mdi-pencil" size="x-small" variant="text" color="grey-darken-1" @click="openTransferDialog" title="Modificar Centre"></v-btn>
                  </div>
                </div>
              </v-col>
            </v-row>

            <v-alert v-if="!student.codi_centre" border="start" border-color="warning" color="orange-lighten-5" variant="flat" density="compact" class="mb-6 text-body-2 text-grey-darken-3">
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
                        Data d'inici: {{ (student.date_start || student.start_date) ? formatDate(student.date_start || student.start_date) : 'Desconeguda' }}
                      </div>

                      <div v-if="getFilesForCurrentCenter().length > 0" class="mt-3 pt-3 border-top-dashed">
                        <div class="text-caption font-weight-bold text-green-darken-3 mb-2 d-flex align-center">
                          <v-icon icon="mdi-check-circle-outline" size="small" class="mr-1"></v-icon>
                          Documentació vigent:
                        </div>
                        
                        <v-list class="bg-transparent pa-0">
                          <v-list-item v-for="file in getFilesForCurrentCenter()" :key="file.filename"
                            rounded="sm"
                            density="compact"
                            class="mb-1 bg-white border-subtle hover-shadow"
                            style="min-height: 48px;"
                            @click="downloadFile(file.filename, file.originalName)"
                          >
                            <template v-slot:prepend>
                              <v-icon :icon="isLatest(file.filename) ? 'mdi-star' : 'mdi-file-pdf-box'" 
                                :color="isLatest(file.filename) ? '#D0021B' : 'grey-darken-2'"></v-icon>
                            </template>
                            
                            <v-list-item-title class="text-body-2 text-grey-darken-3 font-weight-medium">
                              {{ file.originalName }}
                            </v-list-item-title>
                            <v-list-item-subtitle class="text-caption">
                              {{ formatDate(file.uploadDate) }}
                              <span v-if="isLatest(file.filename)" class="text-gencat-red font-weight-bold ml-1">— Versió més recent</span>
                            </v-list-item-subtitle>
                          </v-list-item>
                        </v-list>
                      </div>

                      <div v-else-if="student.has_file" class="mt-3 text-caption text-blue-darken-3 bg-blue-lighten-5 pa-2 rounded-sm d-flex align-center">
                         <v-icon icon="mdi-information-outline" size="small" class="mr-2"></v-icon>
                         PI vigent provinent d'històric o trasllat.
                      </div>
                      <div v-else class="mt-3 text-caption text-orange-darken-3 bg-orange-lighten-5 pa-2 rounded-sm d-flex align-center">
                         <v-icon icon="mdi-alert-circle-outline" size="small" class="mr-2"></v-icon>
                         Pendent de documentació per aquest curs.
                      </div>
                    </div>
                  </div>
                </v-timeline-item>

                <v-timeline-item v-for="(hist, i) in student.school_history" :key="i" 
                  :dot-color="getFilesByHistory(hist).length > 0 ? 'green-darken-1' : 'grey-lighten-1'"
                  size="small"
                  :icon="getFilesByHistory(hist).length > 0 ? 'mdi-file-check' : 'mdi-history'"
                  fill-dot
                >
                  <div class="ml-4 mb-4 transition-swing">
                    
                    <div 
                        class="gencat-timeline-card pa-3 bg-grey-lighten-5 status-border-left"
                        :class="getFilesByHistory(hist).length > 0 ? 'green-border' : 'grey-border'"
                    >
                      <div class="d-flex justify-space-between align-start">
                        <div class="text-body-2 font-weight-bold text-grey-darken-3">
                          {{ getSchoolName(hist.codi_centre) }}
                        </div>
                        
                         <v-chip size="x-small" variant="flat" :color="getFilesByHistory(hist).length > 0 ? 'green-lighten-4' : 'grey-lighten-3'" class="font-weight-bold" :class="getFilesByHistory(hist).length > 0 ? 'text-green-darken-4' : 'text-grey-darken-1'">
                            {{ getFilesByHistory(hist).length > 0 ? 'PI ENTREGAT' : 'SENSE PI' }}
                         </v-chip>
                      </div>

                      <div class="text-caption text-grey-darken-1 mt-1 font-mono mb-2">
                        {{ (hist.date_start || hist.start_date) ? formatDate(hist.date_start || hist.start_date) : '...' }} 
                        — 
                        {{ (hist.date_end || hist.end_date) ? formatDate(hist.date_end || hist.end_date) : '...' }}
                      </div>

                      <v-divider class="border-subtle mb-2"></v-divider>

                      <div v-if="getFilesByHistory(hist).length > 0">
                         <div class="text-caption text-green-darken-2 font-weight-bold mb-1">Arxius adjunts:</div>
                         <div class="d-flex flex-wrap gap-1">
                            <v-chip v-for="file in getFilesByHistory(hist)" :key="file.filename"
                                size="small"
                                variant="tonal"
                                color="green-darken-3"
                                class="bg-white border-green-subtle"
                                @click="downloadFile(file.filename, file.originalName)"
                                prepend-icon="mdi-paperclip"
                            >
                                <span class="text-truncate" style="max-width: 180px;">{{ file.originalName }}</span>
                            </v-chip>
                         </div>
                      </div>

                      <div v-else class="d-flex align-center text-caption text-grey-darken-1 font-italic">
                         <v-icon icon="mdi-close" size="x-small" class="mr-1"></v-icon> No consta documentació d'aquest període.
                      </div>
                    </div>
                  </div>
                </v-timeline-item>
              </v-timeline>

              <div v-if="(!student.school_history || student.school_history.length === 0)" class="text-center py-6 text-grey-lighten-1">
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
                <v-file-input 
                  label="Adjuntar nou PI (PDF, DOCX, ODT)" 
                  variant="plain" 
                  density="compact" 
                  accept=".pdf,.docx,.doc,.odt"
                  prepend-icon="" 
                  prepend-inner-icon="mdi-cloud-upload-outline" 
                  hide-details="auto" 
                  class="file-input-custom"
                  @update:model-value="handleUpload"
                ></v-file-input>
              </div>

              <div v-if="normalizedFiles.length === 0" class="empty-state text-center py-8 border rounded-sm bg-grey-lighten-5">
                <v-icon icon="mdi-file-document-outline" size="large" color="grey-lighten-1" class="mb-2"></v-icon>
                <div class="text-body-2 text-grey">No hi ha documents adjunts.</div>
              </div>

              <div v-else class="file-list-container">
                <div class="text-caption font-weight-bold text-grey-darken-2 mb-2 px-1">Llistat complet</div>
                <v-list lines="two" class="pa-0">
                  <v-list-item v-for="(file, index) in normalizedFiles" :key="index" class="file-item border-subtle mb-2 rounded-sm pa-2 pr-1">
                     <template v-slot:prepend>
                        <div class="file-icon-box rounded-sm d-flex align-center justify-center mr-3"
                             :class="getFileExtension(file.filename) === 'PDF' ? 'bg-red-lighten-5 text-gencat-red' : 'bg-blue-lighten-5 text-blue-darken-3'">
                           <span class="font-weight-bold text-caption">{{ getFileExtension(file.filename) }}</span>
                        </div>
                     </template>

                    <v-list-item-title class="font-weight-bold text-body-2 text-grey-darken-3 text-truncate" :title="file.originalName">
                      {{ file.originalName || file.filename }}
                    </v-list-item-title>
                    <v-list-item-subtitle class="text-caption text-grey-darken-1">
                      {{ formatDate(file.uploadDate) }}
                    </v-list-item-subtitle>

                    <template v-slot:append>
                       <div class="d-flex align-center">
                          <v-btn 
                            icon="mdi-open-in-new" 
                            variant="text" 
                            density="comfortable" 
                            size="small" 
                            color="blue-darken-3" 
                            title="Obrir"
                            @click="window.open(`http://localhost:3001/uploads/${file.filename}`, '_blank')"
                          ></v-btn>

                          <v-btn v-if="['PDF', 'DOCX', 'ODT'].includes(getFileExtension(file.filename))" 
                            icon="mdi-robot-outline" 
                            variant="text" 
                            density="comfortable" 
                            size="small" 
                            color="purple-darken-2" 
                            title="Resum IA"
                            @click="openRoleDialog(file)"
                          ></v-btn>

                          <v-btn 
                            icon="mdi-download-outline" 
                            variant="text" 
                            density="comfortable" 
                            size="small" 
                            color="grey-darken-3" 
                            title="Descarregar"
                            @click="downloadFile(file.filename, file.originalName)"
                          ></v-btn>

                          <v-btn 
                            icon="mdi-trash-can-outline" 
                            variant="text" 
                            density="comfortable" 
                            size="small" 
                            color="#D0021B" 
                            title="Eliminar"
                            @click="deleteFile(file.filename)"
                          ></v-btn>
                       </div>
                    </template>
                  </v-list-item>
                </v-list>
              </div>
            </v-card-text>
          </v-card>

          <!-- GLOBAL SUMMARY IA -->
          <v-card class="gencat-card mt-6 border-red-light" elevation="0" rounded="lg">
            <v-card-title class="pa-4 bg-red-lighten-5 border-bottom-subtle">
              <div class="text-subtitle-1 font-weight-black text-red-darken-4 d-flex align-center gencat-font" style="letter-spacing: 0.5px;">
                <v-icon icon="mdi-auto-fix" class="mr-2"></v-icon>
                RESUM EVOLUTIU IA
              </div>
            </v-card-title>
            <v-card-text class="pa-4">
              <p class="text-body-2 text-grey-darken-1 mb-4" style="line-height: 1.5;">
                Analitza l'historial complet de l'alumne per trobar patrons i evolució.
              </p>
              
              <div v-if="student.global_summary?.estado === 'COMPLETAT'" class="bg-white border pa-4 rounded-sm">
                <div class="d-flex align-center mb-3">
                    <v-chip color="red-darken-4" size="x-small" variant="flat" class="mr-2 font-weight-bold">IA ACTUALITZAT</v-chip>
                </div>
                <div class="text-body-2 text-grey-darken-3 font-italic mb-4 line-clamp-3" style="white-space: pre-line;">
                   {{ student.global_summary.resumen }}
                </div>
                <v-btn block color="#D0021B" variant="flat" class="text-none font-weight-bold text-white" @click="goToSummary({ filename: student.hash_id }, 'global')">
                    Veure Resum de Trajectòria
                </v-btn>
                <v-btn block variant="text" color="grey-darken-3" class="text-none font-weight-bold mt-2" @click="generateGlobalSummary" :loading="loadingGlobal">
                    <v-icon start icon="mdi-refresh"></v-icon>
                    Tornar a generar
                </v-btn>
              </div>

              <div v-else-if="student.global_summary?.estado && student.global_summary?.estado !== 'PENDENT' && student.global_summary?.estado !== 'COMPLETAT'" 
                   class="text-center py-6 bg-grey-lighten-5 rounded-sm border-dashed">
                
                <div class="d-flex align-center justify-center mb-3">
                    <v-icon :icon="student.global_summary.estado === 'LLEGINT...' ? 'mdi-scanning-helper' : 'mdi-robot-outline'" 
                            :class="student.global_summary.estado === 'GENERANT...' ? 'robot-pulse-fast' : 'robot-pulse'"
                            :color="student.global_summary.estado === 'LLEGINT...' ? 'blue' : 'purple'"
                            size="28" class="mr-2"></v-icon>
                    <span class="text-overline font-weight-black" :class="student.global_summary.estado === 'LLEGINT...' ? 'text-blue' : 'text-purple'">
                      {{ student.global_summary.estado }}
                    </span>
                </div>

                <div v-if="student.global_summary.resumen && student.global_summary.resumen.length > 5" 
                     class="text-left bg-white pa-3 text-caption text-grey-darken-3 font-mono border rounded-sm mx-4 mb-3"
                     style="max-height: 200px; overflow-y: auto; white-space: pre-line; scroll-behavior: smooth;">
                    {{ student.global_summary.resumen }}<span class="cursor-blink">|</span>
                </div>
                <div v-else class="text-caption text-grey-darken-1 px-4 mb-3">
                  {{ student.global_summary.estado === 'A LA CUA' ? 'Esperant torn al servidor...' : 'Analitzant historial acadèmic...' }}
                </div>
                
                <v-progress-linear color="purple" indeterminate height="2" class="mt-2 mx-auto" style="max-width: 80%"></v-progress-linear>
              </div>

              <v-btn v-else 
                block 
                color="grey-darken-3" 
                variant="outlined" 
                class="text-none font-weight-bold py-6" 
                prepend-icon="mdi-robot-outline" 
                :disabled="normalizedFiles.length === 0 || loadingGlobal" 
                :loading="loadingGlobal"
                @click="generateGlobalSummary"
              >
                Generar Resum d'Historial
              </v-btn>
            </v-card-text>
          </v-card>
        </div>
      </v-col>
    </v-row>

    <!-- ROLES DIALOG -->
    <v-dialog v-model="showRoleDialog" max-width="450px">
      <v-card class="gencat-card" rounded="lg">
        <v-card-title class="bg-red-lighten-5 pa-4 border-bottom-subtle text-body-1 font-weight-bold text-red-darken-4">
          Configuració del Resum IA
        </v-card-title>
        <v-card-text class="pa-6">
          <v-btn block variant="outlined" color="#D0021B" class="mb-3 text-none py-7" @click="selectRole('docent')">
            <v-icon start icon="mdi-account-school" class="mr-2"></v-icon>
            PERFIL DOCENT
          </v-btn>
          <v-btn block variant="outlined" color="grey-darken-3" class="text-none py-7" @click="selectRole('orientador')">
            <v-icon start icon="mdi-account-tie" class="mr-2"></v-icon>
            PERFIL ORIENTADOR
          </v-btn>
        </v-card-text>
      </v-card>
    </v-dialog>

    <!-- TRANSFER DIALOG -->
    <v-dialog v-model="showTransferDialog" max-width="500px">
      <v-card class="gencat-card" rounded="sm">
        <v-card-title class="bg-grey-lighten-4 pa-4 border-bottom-subtle text-body-1 font-weight-bold">
          Canvi de Centre
        </v-card-title>
        <v-card-text class="pa-6">
          <v-autocomplete v-model="selectedNewSchool" :items="schoolsList" item-title="denominacio_completa" item-value="codi_centre" label="Nou centre" variant="outlined" density="compact" class="mb-4"></v-autocomplete>
          <v-text-field v-model="transferStartDate" label="Data d'inici" type="date" variant="outlined" density="compact"></v-text-field>
        </v-card-text>
        <v-card-actions class="pa-4 bg-grey-lighten-5">
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="showTransferDialog = false">Cancel·lar</v-btn>
          <v-btn color="#D0021B" class="text-white" flat @click="executeTransfer">Guardar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

  </v-container>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useStudentStore } from '@/stores/studentStore';

const route = useRoute();
const router = useRouter();
const studentStore = useStudentStore();
let globalSSE = null;

const schoolsList = ref([]);
const showTransferDialog = ref(false);
const showConfirmDialog = ref(false);
const selectedNewSchool = ref(null);
const transferStartDate = ref('');
const transferEndDate = ref('');
 
const showRoleDialog = ref(false);
const selectedFileForSummary = ref(null);
const loadingGlobal = ref(false);

const student = computed(() => studentStore.students.find(s => s.hash_id === route.params.hash_id));
const normalizedFiles = computed(() => (student.value && Array.isArray(student.value.files)) ? student.value.files : []);

const openTransferDialog = () => {
  selectedNewSchool.value = student.value.codi_centre;
  transferStartDate.value = new Date().toISOString().split('T')[0];
  showTransferDialog.value = true;
};

const executeTransfer = async () => {
  const userEmail = localStorage.getItem('userEmail') || 'usuari';
  try {
    const response = await fetch(`http://localhost:3001/api/students/${student.value.hash_id}/transfer`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        new_center_id: selectedNewSchool.value,
        start_date: transferStartDate.value,
        userEmail: userEmail
      })
    });
    if (response.ok) {
      await studentStore.fetchStudents();
      showTransferDialog.value = false;
    }
  } catch (e) { console.error(e); }
};

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

const goToSummary = (file, role = 'docent') => {
  router.push({ 
    name: 'SummaryPage', 
    params: { filename: file.filename },
    query: { role: role }
  });
};

const generateGlobalSummary = async () => {
    loadingGlobal.value = true;
    try {
        const response = await fetch('http://localhost:3001/api/generate-global-summary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentHash: route.params.hash_id, userEmail: localStorage.getItem('userEmail') || 'usuari' })
        });
        
        if (response.ok) {
             await studentStore.fetchStudents();
             startGlobalSSE();
        }
    } catch (e) {
        console.error(e);
    } finally {
        loadingGlobal.value = false;
    }
};

const startGlobalSSE = () => {
    if (globalSSE) return;
    const hash = route.params.hash_id;
    
    globalSSE = new EventSource(`http://localhost:3001/api/progress/${hash}`);
    globalSSE.onmessage = (e) => {
        try {
            const data = JSON.parse(e.data);
            if (data.status === 'CONNECTED') return;
            if (data.role !== 'global') return; // Ignore file summaries here

            // Update local student store directly to reflect progress
            const sIdx = studentStore.students.findIndex(s => s.hash_id === hash);
            if (sIdx !== -1) {
                const s = studentStore.students[sIdx];
                if (!s.global_summary) s.global_summary = {};
                s.global_summary.estado = data.status;
                s.global_summary.progress = data.progress;
                if (data.resumen) s.global_summary.resumen = data.resumen;
                
                // Trigger reactivity trick if needed, but array mutation usually works in Vue 3
            }

            if (data.status === 'COMPLETAT' || data.status === 'INTERROMPUT' || data.status === 'ERROR') {
                globalSSE.close();
                globalSSE = null;
            }
        } catch (err) { console.error(err); }
    };
};

const handleUpload = async (files) => {
  const file = Array.isArray(files) ? files[0] : files;
  if (file) {
    const success = await studentStore.uploadStudentPI(file, route.params.hash_id);
    if (success) await studentStore.fetchStudents();
  }
};

const downloadFile = (filename, originalName) => {
  window.open(`http://localhost:3001/uploads/${filename}`, '_blank');
};

const deleteFile = async (filename) => {
  if (confirm('Eliminar?')) {
    await studentStore.deleteFile(route.params.hash_id, filename);
  }
};

const getSchoolName = (code) => {
  const found = schoolsList.value.find(s => s.codi_centre === code);
  return found ? found.denominacio_completa : code;
};

const currentSchoolName = computed(() => student.value?.codi_centre ? getSchoolName(student.value.codi_centre) : 'Sense centre');
const getFileExtension = (fn) => fn.split('.').pop().toUpperCase();
const formatDate = (d) => d ? new Date(d).toLocaleDateString('ca-ES') : '-';
const getFilesForCurrentCenter = () => normalizedFiles.value;
const getFilesByHistory = () => [];
const goToList = () => router.push('/alumnos');
const isLatest = () => false;

onMounted(async () => {
  await studentStore.fetchStudents();
  try {
    const res = await fetch('http://localhost:3001/api/centros');
    if (res.ok) schoolsList.value = await res.json();
  } catch (e) { }

  // Check if we need to listen for global summary
  if (student.value && student.value.global_summary) {
    const st = student.value.global_summary.estado;
    if (st === 'A LA CUA' || st === 'LLEGINT...' || st === 'GENERANT...') {
        startGlobalSSE();
    }
  }
});

onUnmounted(() => {
    if (globalSSE) globalSSE.close();
});
</script>

<style scoped>
.text-gencat-red { color: #C00021 !important; }
.bg-gencat-background { background-color: #F5F5F7 !important; }
.gencat-card { border: 1px solid #E0E0E0 !important; }
.data-box { background-color: #FAFAFA; border: 1px solid #EEEEEE; padding: 12px; }
.history-container { max-height: 500px; overflow-y: auto; }
.robot-pulse { animation: pulse-primary 3s infinite; }
.robot-pulse-fast { animation: pulse-primary 1s infinite; }
@keyframes pulse-primary {
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.1); opacity: 0.7; }
  100% { transform: scale(1); opacity: 1; }
}
.border-dashed { border: 1px dashed #e0e0e0 !important; }
.cursor-blink { animation: blink 1s step-end infinite; color: #D0021B; font-weight: bold; }
@keyframes blink { 50% { opacity: 0; } }
</style>
