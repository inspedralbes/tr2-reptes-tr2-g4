<template>
    <v-container>
        <div class="d-flex justify-space-between align-center mb-4">
            <h1>Bústia de Normalització PI</h1>
        </div>

        <v-row class="mb-2">
            <v-col cols="12" md="6">
                <v-text-field
                    v-model="searchName"
                    label="Buscar per Inicials"
                    prepend-inner-icon="mdi-account-search"
                    variant="outlined"
                    clearable
                    hide-details="auto"
                ></v-text-field>
            </v-col>

            <v-col cols="12" md="6">
                <v-text-field
                    v-model="searchRalc"
                    label="Buscar per RALC (últims dígits)"
                    prepend-inner-icon="mdi-numeric"
                    variant="outlined"
                    clearable
                    hide-details="auto"
                ></v-text-field>
            </v-col>
        </v-row>

        <v-row>
            <v-col cols="12">
                <v-list lines="two">
                    <v-list-item v-for="student in filteredStudents" :key="student.hash_id"
                        :subtitle="student.visual_identity.ralc_suffix" :title="student.visual_identity.iniciales">
                        <template v-slot:prepend>
                            <v-avatar color="grey-lighten-1">
                                <v-icon color="white">{{ student.has_file ? 'mdi-check-circle' : 'mdi-account' }}</v-icon>
                            </v-avatar>
                        </template>

                        <template v-slot:append>
                            <router-link :to="`/perfil/${student.hash_id}`">
                                <v-btn icon="mdi-account-details" variant="text" color="primary" class="mr-2"></v-btn>
                            </router-link>
                            
                            <v-chip v-if="student.has_file" 
                                :to="`/perfil/${student.hash_id}`"
                                link
                                color="blue-grey-darken-1" 
                                variant="outlined" 
                                class="mr-4 font-weight-bold">
                                <v-icon start icon="mdi-folder"></v-icon>
                                {{ student.files?.length || 1 }} Docs
                            </v-chip>

                            <div style="width: 250px">
                                <v-file-input label="Pujar PI (PDF)" variant="outlined" density="compact"
                                    accept=".pdf" prepend-icon="mdi-cloud-upload" hide-details
                                    @update:model-value="(files) => handleUpload(files, student.hash_id)"></v-file-input>
                            </div>
                        </template>
                    </v-list-item>
                </v-list>
            </v-col>
        </v-row>

        <v-snackbar v-model="showError" color="error">
            {{ studentStore.error }}
        </v-snackbar>
    </v-container>
</template>

<script setup>
import { onMounted, ref, watch, computed } from 'vue';
import { useStudentStore } from '@/stores/studentStore';

const studentStore = useStudentStore();
const showError = ref(false);

// CAMBIO 1: Creamos dos variables reactivas separadas
const searchName = ref('');
const searchRalc = ref('');

// CAMBIO 2: Lógica de filtrado combinada
const filteredStudents = computed(() => {
    return studentStore.students.filter(student => {
        // Obtenemos los valores de búsqueda en minúsculas (o string vacío si es null)
        const nameInput = (searchName.value || '').toLowerCase();
        const ralcInput = (searchRalc.value || '').toLowerCase();

        // 1. Verificamos si coincide el NOMBRE (Si el input está vacío, devuelve true automáticamente)
        const matchesName = !nameInput || 
                            (student.original_name || '').toLowerCase().includes(nameInput) ||
                            student.visual_identity.iniciales.toLowerCase().includes(nameInput);

        // 2. Verificamos si coincide el RALC (Si el input está vacío, devuelve true automáticamente)
        const matchesRalc = !ralcInput || 
                            (student.original_id || '').includes(ralcInput) ||
                            student.visual_identity.ralc_suffix.toLowerCase().includes(ralcInput);

        // 3. Devuelve el estudiante solo si cumple AMBAS condiciones
        return matchesName && matchesRalc;
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
            console.log("Archivo subido correctamente");
        } else {
            showError.value = true;
        }
    }
};

watch(() => studentStore.error, (newVal) => {
        if (newVal) showError.value = true;
});
</script>