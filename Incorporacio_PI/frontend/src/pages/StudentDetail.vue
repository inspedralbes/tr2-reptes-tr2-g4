<template>
  <v-container>
    <v-btn
      class="mb-4"
      variant="text"
      prepend-icon="mdi-arrow-left"
      @click="goToList"
    >
      Volver al listado
    </v-btn>

    <div v-if="studentStore.loading && !student" class="d-flex justify-center mt-10">
      <v-progress-circular indeterminate color="primary" size="64"></v-progress-circular>
    </div>

    <v-card v-else-if="student" class="mx-auto pa-4" max-width="800" elevation="2">
      <v-card-title class="text-h5 font-weight-bold d-flex align-center">
        <v-avatar color="primary" class="mr-4" size="80">
          <span class="text-h4 text-white d-flex align-center justify-center w-100 h-100" style="line-height: 1;">{{ student.visual_identity?.iniciales }}</span>
        </v-avatar>
        Detalle del Estudiante
      </v-card-title>
      
      <v-divider class="my-3"></v-divider>

      <v-card-text>
        <v-row>
          <v-col cols="12" md="6">
            <v-list-item>
              <template v-slot:prepend>
                <v-icon icon="mdi-account-circle-outline" color="primary"></v-icon>
              </template>
              <v-list-item-title>Iniciales</v-list-item-title>
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
              <v-list-item-title>Sufijo RALC</v-list-item-title>
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
                Estado del Plan Individual (PI)
              </div>
              <div>
                {{ student.has_file ? 'El documento ha sido subido correctamente.' : 'Pendiente de subir documento.' }}
              </div>
            </v-alert>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <v-alert v-else type="error" variant="tonal" class="mt-4">
      No se ha encontrado ningún estudiante con este identificador.
    </v-alert>

    <v-card v-if="student && normalizedFiles.length > 0" class="mx-auto mt-4 pa-4" max-width="800" elevation="2">
      <v-card-title class="text-h6 d-flex align-center">
        <v-icon icon="mdi-file-document-multiple-outline" class="mr-2" color="primary"></v-icon>
        Documentos Adjuntos
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
            Subido el: {{ formatDate(file.uploadDate) }}
          </v-list-item-subtitle>

          <template v-slot:append>
            <v-chip size="small" class="mr-2" color="primary" variant="outlined">
              {{ getFileExtension(file.filename) }}
            </v-chip>
            <v-btn v-if="getFileExtension(file.filename) === 'PDF'"
              icon="mdi-robot" variant="text" color="purple" title="Generar Resum IA"
              @click="goToSummary(file)">
            </v-btn>
            <v-btn :href="`http://localhost:3001/uploads/${file.filename}`" target="_blank" icon="mdi-open-in-new"
              variant="text" color="primary" title="Abrir documento">
            </v-btn>
            <v-btn icon="mdi-download" variant="text" color="success" title="Descargar documento"
              @click="downloadFile(file.filename, file.originalName)">
            </v-btn>
            <v-btn icon="mdi-delete" variant="text" color="error" title="Eliminar documento"
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
          Volver a la lista de estudiantes
        </v-btn>
      </v-col>
    </v-row>

  </v-container>
</template>

<script setup>
import { computed, onMounted, watch, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router'; // <--- AÑADIDO useRouter
import { useStudentStore } from '@/stores/studentStore';

const route = useRoute();
const router = useRouter(); // <--- Inicializamos router
const studentStore = useStudentStore();

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
      originalName: 'Documento PI (Versión anterior)',
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
  if (!dateVal) return 'Fecha desconocida';
  return new Date(dateVal).toLocaleString();
};

watch(normalizedFiles, (newFiles) => {
  console.log('🔄 VISTA ACTUALIZADA: La lista de documentos ha cambiado.', newFiles);
});

const goToSummary = (file) => {
  // Redirigim a la nova pàgina de resum
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
    console.error('Error downloading file:', error);
  }
};

const deleteFile = async (filename) => {
  console.log(`🗑️ INICIO: Solicitando eliminar archivo: ${filename}`);
  if (!confirm('¿Estás seguro de que quieres eliminar este archivo?')) return;

  try {
    const response = await fetch(`http://localhost:3001/api/students/${route.params.hash_id}/files/${encodeURIComponent(filename)}`, {
      method: 'DELETE'
    });

    console.log(`📡 RESPUESTA SERVIDOR: Status ${response.status}`);

    if (response.ok) {
      console.log('✅ OK: Archivo borrado. Recargando datos del store...');
      await studentStore.fetchStudents(); 
      console.log('✨ FIN: Datos recargados.');
    } else {
      console.error('Error del servidor:', response.status);
      alert('Error al borrar. Revisa la consola.');
    }
  } catch (error) {
    console.error('Error eliminando archivo:', error);
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
</style>