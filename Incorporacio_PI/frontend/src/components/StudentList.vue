<template>
    <v-container>
        <div class="d-flex justify-space-between align-center mb-4">
            <h1>Bústia de Normalització PI</h1>
        </div>

        <!-- Buscador -->
        <v-text-field
            v-model="searchTerm"
            label="Buscar per Nom o ID RALC"
            prepend-inner-icon="mdi-magnify"
            variant="outlined"
            clearable
            class="mb-4"
        ></v-text-field>

        <v-row>
            <v-col cols="12">
                <v-list lines="two">
                    <!-- Iteramos sobre la lista filtrada -->
                    <v-list-item v-for="student in filteredStudents" :key="student.hash_id"
                        :subtitle="student.visual_identity.ralc_suffix" :title="student.visual_identity.iniciales">
                        <template v-slot:prepend>
                            <v-avatar color="grey-lighten-1">
                                <v-icon color="white">{{ student.has_file ? 'mdi-check-circle' : 'mdi-account'
                                    }}</v-icon>
                            </v-avatar>
                        </template>

                        <template v-slot:append>
                            <router-link :to="`/perfil/${student.hash_id}`">
                                <v-btn icon="mdi-account-details" variant="text" color="primary" class="mr-2"></v-btn>
                            </router-link>
                            
                            <!-- Chip mejorado para el contador de archivos -->
                            <v-chip v-if="student.has_file" 
                                color="blue-grey-darken-1" 
                                variant="outlined" 
                                class="mr-4 font-weight-bold">
                                <v-icon start icon="mdi-paperclip"></v-icon>
                                {{ student.files?.length || 1 }} Docs
                            </v-chip>

                            <div style="width: 250px">
                                <v-file-input label="Pujar PI (PDF)" variant="outlined" density="compact"
                                    accept=".pdf, .doc, .docx" prepend-icon="mdi-cloud-upload" hide-details
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
import { useStudentStore } from '@/stores/studentStore'; // Importamos el store que creamos arriba

// 1. Inicializamos el store
const studentStore = useStudentStore();
const showError = ref(false);
const searchTerm = ref('');

// Propiedad computada para filtrar los estudiantes
const filteredStudents = computed(() => {
    if (!searchTerm.value) {
        return studentStore.students;
    }
    const lowerCaseSearch = searchTerm.value.toLowerCase();
    return studentStore.students.filter(student => {
        // 1. Cerca per NOM (si existeix a la BD)
        const nameMatch = (student.original_name || '').toLowerCase().includes(lowerCaseSearch);
        // 2. Cerca per ID RALC (si existeix a la BD)
        const idMatch = (student.original_id || '').includes(lowerCaseSearch);
        // 3. Mantenim cerca per inicials/sufix visual
        const initials = student.visual_identity.iniciales.toLowerCase();
        const ralc = student.visual_identity.ralc_suffix.toLowerCase();
        
        return nameMatch || idMatch || initials.includes(lowerCaseSearch) || ralc.includes(lowerCaseSearch);
    });
});


// 2. Cargamos la lista al iniciar el componente
onMounted(() => {
    studentStore.fetchStudents();
});

// 3. Manejamos la lógica de subida
const handleUpload = async (files, hashId) => {
    // Vuetify devuelve un array de archivos, cogemos el primero
    const file = Array.isArray(files) ? files[0] : files;

    if (file) {
        // Llamamos a la ACCIÓN que creamos en el Store
        const success = await studentStore.uploadStudentPI(file, hashId);

        if (success) {
            console.log("Archivo subido correctamente");
        } else {
            showError.value = true;
        }
    }
};

// Vigilar errores del store para mostrarlos
watch(() => studentStore.error, (newVal) => {
        if (newVal) showError.value = true;
});
</script>