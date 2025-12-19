<template>
    <v-container>
        <h1>Bústia de Normalització PI</h1>

        <v-row>
            <v-col cols="12">
                <v-list lines="two">
                    <v-list-item v-for="student in studentStore.students" :key="student.hash_id"
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
import { onMounted, ref, watch } from 'vue';
import { useStudentStore } from '@/stores/studentStore'; // Importamos el store que creamos arriba

// 1. Inicializamos el store
const studentStore = useStudentStore();
const showError = ref(false);

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