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
                        <h2 class="text-h6 font-weight-bold text-grey-darken-3">Filtres de cerca</h2>
                    </div>
                    
                    <v-row dense>
                        <v-col cols="12" md="6">
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

                        <v-col cols="12" md="6">
                            <v-text-field
                                v-model="searchRalc"
                                label="Cercar per RALC (últims dígits)"
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
                                
                                <v-list-item-subtitle class="d-flex align-center flex-wrap">
                                    <v-chip size="x-small" label class="mr-2 font-weight-medium bg-grey-lighten-3 text-grey-darken-3">
                                        {{ student.visual_identity.ralc_suffix }}
                                    </v-chip>

                                    <v-chip 
                                        v-if="!student.codi_centre"
                                        color="orange-darken-3" 
                                        variant="flat" 
                                        size="x-small" 
                                        class="mr-2 font-weight-bold"
                                    >
                                        <v-icon start icon="mdi-alert-circle-outline" size="small"></v-icon>
                                        Sense Centre
                                    </v-chip>

                                    <span v-if="student.has_file" class="text-caption text-green-darken-2 d-flex align-center">
                                        <v-icon start icon="mdi-file-document-outline" size="small"></v-icon>
                                        {{ student.files?.length || 1 }} Document(s)
                                    </span>
                                    <span v-else class="text-caption text-orange-darken-3">
                                        Pendent de documentació
                                    </span>
                                </v-list-item-subtitle>

                                <template v-slot:append>
                                    <div class="d-flex align-center gap-4">
                                        <div style="width: 200px" class="d-none d-sm-block">
                                            <v-file-input 
                                                label="Pujar PI (PDF)" 
                                                variant="outlined" 
                                                density="compact"
                                                accept=".pdf" 
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
                            <v-icon icon="mdi-account-search-outline" size="64" color="grey-lighten-2" class="mb-4"></v-icon>
                            <h3 class="text-h6 text-grey-darken-2">No s'han trobat alumnes</h3>
                            <p class="text-body-2 text-grey">Proveu de modificar els filtres de cerca.</p>
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

// Recuperamos el código del centro logueado
const currentUserCenter = localStorage.getItem('userCenterCode');

const filteredStudents = computed(() => {
    // 1. Preparamos los términos de búsqueda
    const nameInput = (searchName.value || '').trim().toLowerCase();
    const ralcInput = (searchRalc.value || '').trim().toLowerCase();

    // 2. Detectamos si el usuario está usando el buscador
    const isSearching = nameInput.length > 0 || ralcInput.length > 0;

    return studentStore.students.filter(student => {
        // --- LÓGICA DE COINCIDENCIA DE TEXTO ---
        const matchesName = !nameInput || 
                            (student.original_name || '').toLowerCase().includes(nameInput) ||
                            student.visual_identity.iniciales.toLowerCase().includes(nameInput);

        const matchesRalc = !ralcInput || 
                            (student.original_id || '').includes(ralcInput) ||
                            student.visual_identity.ralc_suffix.toLowerCase().includes(ralcInput);

        // --- LÓGICA DE VISIBILIDAD FINAL ---
        
        if (isSearching) {
            // CASO A: ESTÁ BUSCANDO
            // Si hay texto en los inputs, buscamos en TODOS los centros (Global)
            // Solo devolvemos si coinciden los filtros de texto.
            return matchesName && matchesRalc;
        } else {
            // CASO B: LISTA POR DEFECTO (NO BUSCA)
            // Si no escribe nada, aplicamos el filtro de seguridad estricto (Solo mi centro)
            if (currentUserCenter) {
                return String(student.codi_centre) === String(currentUserCenter);
            }
            // Si no hay usuario logueado (o es admin), mostramos todo por defecto
            return true;
        }
    });
});

onMounted(() => {
    studentStore.fetchStudents();
});

const handleUpload = async (files, hashId) => {
    const file = Array.isArray(files) ? files[0] : files;

    if (file) {
        if (file.type !== 'application/pdf') {
            studentStore.error = "Només s'accepten fitxers PDF!";
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

/* Ajust fi per als inputs perquè semblin més nets */
.gencat-input :deep(.v-field__outline__start),
.gencat-input :deep(.v-field__outline__end),
.gencat-input :deep(.v-field__outline__notch) {
  border-color: rgba(0,0,0,0.2) !important;
}

/* El input de fitxer més petit */
.gencat-file-input :deep(.v-field) {
    font-size: 0.85rem;
    border-radius: 4px;
}
</style>