<template>
  <v-container class="fill-height align-start bg-grey-lighten-5" fluid>
    <v-row justify="center">
      <v-col cols="12" lg="10" xl="8">
        
        <div class="mb-6 mt-4">
          <h1 class="text-h4 font-weight-black text-grey-darken-4 mb-1 gencat-font">
            Gestió d'Expedients PI
          </h1>
          <p class="text-subtitle-1 text-grey-darken-1">
            Consulteu, filtreu i actualitzeu la documentació dels alumnes.
          </p>
        </div>

        <v-card class="pa-6 mb-6 gencat-card" elevation="0" rounded="lg">
          <div class="d-flex align-center mb-4">
            <v-icon icon="mdi-filter-variant" color="#D0021B" class="mr-2"></v-icon>
            <h2 class="text-h6 font-weight-bold text-grey-darken-3">Filtres i Ordenació</h2>
          </div>
          
          <v-row dense>
            <v-col cols="12" sm="6" md="3">
              <v-text-field
                v-model="searchName"
                label="Cercar per Inicials"
                placeholder="Ex: J.M."
                prepend-inner-icon="mdi-account-search"
                variant="outlined"
                density="comfortable"
                clearable
                color="#D0021B"
                base-color="grey-darken-1"
                hide-details="auto"
                class="gencat-input"
              ></v-text-field>
            </v-col>

            <v-col cols="12" sm="6" md="3">
              <v-text-field
                v-model="searchRalc"
                label="RALC (últims dígits)"
                placeholder="Ex: ***123"
                prepend-inner-icon="mdi-numeric"
                variant="outlined"
                density="comfortable"
                clearable
                color="#D0021B"
                base-color="grey-darken-1"
                hide-details="auto"
                class="gencat-input"
              ></v-text-field>
            </v-col>

            <v-col cols="12" sm="6" md="3">
              <v-select
                v-model="filterStatus"
                :items="statusOptions"
                item-title="title"
                item-value="value"
                label="Estat Documentació"
                prepend-inner-icon="mdi-file-document-check-outline"
                variant="outlined"
                density="comfortable"
                color="#D0021B"
                base-color="grey-darken-1"
                hide-details="auto"
                class="gencat-input"
              ></v-select>
            </v-col>

            <v-col cols="12" sm="6" md="3">
              <v-select
                v-model="sortOrder"
                :items="sortOptions"
                item-title="title"
                item-value="value"
                label="Ordenar per..."
                prepend-inner-icon="mdi-sort-clock-ascending-outline"
                variant="outlined"
                density="comfortable"
                color="#D0021B"
                base-color="grey-darken-1"
                hide-details="auto"
                class="gencat-input"
              ></v-select>
            </v-col>
          </v-row>
        </v-card>

        <v-card class="gencat-card" elevation="0" rounded="lg">
          <div class="pa-4 border-b d-flex justify-space-between align-center bg-grey-lighten-5">
            <span class="font-weight-bold text-grey-darken-3">
              {{ filteredStudents.length }} Alumnes trobats
            </span>
            <v-btn icon="mdi-refresh" variant="text" size="small" color="grey-darken-1" @click="studentStore.fetchStudents()"></v-btn>
          </div>

          <v-list lines="two" class="pa-0">
            <template v-for="(student, index) in filteredStudents" :key="student.hash_id">
              
              <v-list-item class="py-3">
                <template v-slot:prepend>
                  <v-avatar :color="student.has_file ? 'green-lighten-5' : 'grey-lighten-4'" size="48" class="mr-3 border">
                    <v-icon :color="student.has_file ? 'green-darken-2' : 'grey-darken-1'">
                      {{ student.has_file ? 'mdi-check-bold' : 'mdi-account' }}
                    </v-icon>
                  </v-avatar>
                </template>

                <v-list-item-title class="font-weight-bold text-grey-darken-3 text-body-1 mb-1">
                  {{ student.visual_identity.iniciales }}
                </v-list-item-title>
                
                <v-list-item-subtitle class="d-flex align-center flex-wrap" style="gap: 8px;">
                  
                  <v-chip size="x-small" label class="font-weight-medium bg-grey-lighten-3 text-grey-darken-3">
                    {{ student.visual_identity.ralc_suffix }}
                  </v-chip>

                  <v-chip 
                    v-if="student.codi_centre" 
                    size="x-small" 
                    color="blue-grey-lighten-4" 
                    class="font-weight-bold text-blue-grey-darken-3"
                    prepend-icon="mdi-domain"
                  >
                    {{ getSchoolName(student.codi_centre) }}
                  </v-chip>

                  <v-chip 
                    v-else
                    color="orange-darken-3" 
                    variant="flat" 
                    size="x-small" 
                    class="font-weight-bold"
                  >
                    <v-icon start icon="mdi-alert-circle-outline" size="small"></v-icon>
                    Sense Centre
                  </v-chip>

                  <span v-if="student.has_file" class="text-caption text-green-darken-2 d-flex align-center ml-2">
                    <v-icon start icon="mdi-file-document-outline" size="small"></v-icon>
                    {{ student.files?.length || 1 }} Document(s)
                  </span>
                  <span v-else class="text-caption text-orange-darken-3 ml-2">
                    Pendent de documentació
                  </span>

                </v-list-item-subtitle>

                <template v-slot:append>
                  <div class="d-flex align-center gap-4">
                    <div style="width: 200px" class="d-none d-sm-block">
                      <v-file-input 
                        label="Pujar PI (PDF, Word, ODT)" 
                        variant="outlined" 
                        density="compact"
                        accept=".pdf,.docx,.doc,.odt" 
                        prepend-icon=""
                        prepend-inner-icon="mdi-cloud-upload" 
                        hide-details
                        color="#D0021B"
                        base-color="grey-lighten-1"
                        class="gencat-file-input"
                        @update:model-value="(files) => handleUpload(files, student.hash_id)"
                      ></v-file-input>
                    </div>

                    <v-tooltip text="Veure detalls complets" location="top">
                      <template v-slot:activator="{ props }">
                        <v-btn 
                          icon="mdi-chevron-right" 
                          variant="text" 
                          color="grey-darken-2" 
                          v-bind="props"
                          :to="`/perfil/${student.hash_id}`"
                        ></v-btn>
                      </template>
                    </v-tooltip>
                  </div>
                </template>
              </v-list-item>
              
              <v-divider v-if="index < filteredStudents.length - 1" inset></v-divider>
            </template>

            <div v-if="filteredStudents.length === 0" class="text-center pa-8">
              <v-icon icon="mdi-filter-off-outline" size="64" color="grey-lighten-2" class="mb-4"></v-icon>
              <h3 class="text-h6 text-grey-darken-2">No hi ha resultats</h3>
              <p class="text-body-2 text-grey">Proveu de canviar els filtres o l'estat de documentació.</p>
            </div>
          </v-list>
        </v-card>
      </v-col>
    </v-row>

    <v-snackbar v-model="showError" color="#D0021B" location="top">
      <div class="d-flex align-center">
        <v-icon icon="mdi-alert-circle" color="white" class="mr-2"></v-icon>
        {{ studentStore.error }}
      </div>
    </v-snackbar>
    
  </v-container>
</template>

<script setup>
import { onMounted, ref, watch, computed } from 'vue';
import { useStudentStore } from '@/stores/studentStore';

const studentStore = useStudentStore();
const showError = ref(false);

const searchName = ref('');
const searchRalc = ref('');
const schoolsList = ref([]);

// Filtro Estado PI
const filterStatus = ref('all');
const statusOptions = [
  { title: 'Tots els estats', value: 'all' },
  { title: 'Amb PI pujat', value: 'with_pi' },
  { title: 'Pendent de PI', value: 'without_pi' }
];

// --- ORDENACIÓ DE MAIN (SIMPLE) ---
const sortOrder = ref('default'); 
const sortOptions = [
  { title: 'Per defecte (Sense ordre)', value: 'default' },
  { title: 'Alfabètic (A-Z)', value: 'alpha_asc' }
];

// Configuración de Producción
const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:3001');
const currentUserCenter = localStorage.getItem('userCenterCode');

const getSchoolName = (code) => {
  if (!code) return '';
  const found = schoolsList.value.find(s => String(s.codi_centre) === String(code));
  return found ? (found.denominacio_completa || found.nom_centre) : `Centre: ${code}`;
};

const filteredStudents = computed(() => {
  // 1. Filtrado
  const nameInput = (searchName.value || '').trim().toLowerCase();
  const ralcInput = (searchRalc.value || '').trim().toLowerCase();
  const isTextSearching = nameInput.length > 0 || ralcInput.length > 0;

  let filtered = studentStore.students.filter(student => {
    // A. Nombre
    const matchesName = !nameInput || 
                (student.original_name || '').toLowerCase().includes(nameInput) ||
                student.visual_identity.iniciales.toLowerCase().includes(nameInput);

    // B. RALC
    const matchesRalc = !ralcInput || 
                (student.original_id || '').includes(ralcInput) ||
                student.visual_identity.ralc_suffix.toLowerCase().includes(ralcInput);
    
    // C. Estado PI
    let matchesStatus = true;
    if (filterStatus.value === 'with_pi') matchesStatus = student.has_file === true;
    else if (filterStatus.value === 'without_pi') matchesStatus = !student.has_file;

    // D. Ámbito (Centro vs Global)
    let matchesScope = true;
    if (!isTextSearching && currentUserCenter) {
      matchesScope = String(student.codi_centre) === String(currentUserCenter);
    }

    return matchesScope && matchesName && matchesRalc && matchesStatus;
  });

  // 2. Ordenación (Sorting) - Lógica de MAIN (Simple)
  if (sortOrder.value === 'alpha_asc') {
    return filtered.sort((a, b) => {
      const nameA = a.visual_identity?.iniciales || '';
      const nameB = b.visual_identity?.iniciales || '';
      return nameA.localeCompare(nameB);
    });
  }

  // Si es 'default', devolvemos la lista tal cual
  return filtered;
});

onMounted(async () => {
  studentStore.fetchStudents();
  try {
    const res = await fetch(`${API_URL}/api/centros`);
    if (res.ok) {
      schoolsList.value = await res.json();
    }
  } catch (e) {
    console.error("Error cargando lista de centros:", e);
  }
});

const handleUpload = async (files, hashId) => {
  const file = Array.isArray(files) ? files[0] : files;

  if (file) {
    // CAMBIO APLICADO: Filtro ampliado de Prova
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword', 'application/vnd.oasis.opendocument.text'];
    
    if (!allowedTypes.includes(file.type)) {
      studentStore.error = "Només s'accepten fitxers PDF, DOCX i ODT!";
      showError.value = true;
      return;
    }
    const success = await studentStore.uploadStudentPI(file, hashId);
    if (success) {
      console.log("Arxiu pujat correctament");
    } else {
      showError.value = true;
    }
  }
};

watch(() => studentStore.error, (newVal) => {
    if (newVal) showError.value = true;
});
</script>

<style scoped>
/* ESTILS CORPORATIUS GENCAT */
.gencat-font {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
}

.gencat-card {
  border: 1px solid rgba(0,0,0,0.1) !important;
  background-color: white;
}

.gencat-input :deep(.v-field__outline__start),
.gencat-input :deep(.v-field__outline__end),
.gencat-input :deep(.v-field__outline__notch) {
  border-color: rgba(0,0,0,0.2) !important;
}

.gencat-file-input :deep(.v-field) {
  font-size: 0.85rem;
  border-radius: 4px;
}
</style>