<template>
  <v-container class="fill-height align-start bg-grey-lighten-5" fluid>
    <v-row justify="center">
      <v-col cols="12" lg="10" xl="8">
        
        <div class="d-flex align-center justify-space-between mb-6 mt-4">
          <div class="d-flex align-center">
            <v-btn 
                variant="text" 
                prepend-icon="mdi-arrow-left" 
                @click="$router.push('/dashboard')" 
                color="grey-darken-3"
                class="mr-4 text-none font-weight-bold pl-0"
            >
                Tornar al Tauler
            </v-btn>
            <v-divider vertical class="mr-4 border-opacity-50" style="height: 24px"></v-divider>
            
            <div>
                <h1 class="text-h5 font-weight-black text-grey-darken-3 gencat-font mb-0">
                Auditoria i Registre
                </h1>
                <div class="text-caption text-grey-darken-1">
                Històric dels darrers moviments registrats a la plataforma
                </div>
            </div>
          </div>

          <v-btn 
            prepend-icon="mdi-refresh" 
            variant="outlined" 
            color="#D0021B" 
            class="bg-white border-red text-none"
            @click="refreshData"
            :loading="loading"
          >
            Actualitzar
          </v-btn>
        </div>

        <div class="mb-4">
            <span class="text-caption font-weight-bold text-grey-darken-2 mr-2">FILTRAR PER TIPUS:</span>
            <v-chip-group v-model="selectedFilter" selected-class="text-red-darken-4" mandatory>
                <v-chip filter value="all" variant="outlined" color="grey-darken-1" size="small">
                    Tots
                </v-chip>
                <v-chip filter value="trasllat" variant="outlined" color="orange-darken-4" size="small">
                    <v-icon start icon="mdi-transfer" size="small"></v-icon> Trasllats
                </v-chip>
                <v-chip filter value="pujada" variant="outlined" color="green-darken-3" size="small">
                    <v-icon start icon="mdi-cloud-upload" size="small"></v-icon> Pujades
                </v-chip>
                <v-chip filter value="nou" variant="outlined" color="blue-darken-3" size="small">
                    <v-icon start icon="mdi-account-plus" size="small"></v-icon> Altes
                </v-chip>
            </v-chip-group>
        </div>

        <v-card class="gencat-card" elevation="0" rounded="lg">
          
          <v-table density="comfortable" hover>
            <thead>
              <tr class="bg-grey-lighten-4">
                <th class="text-left text-caption font-weight-bold text-grey-darken-2 py-3">DATA I HORA</th>
                <th class="text-left text-caption font-weight-bold text-grey-darken-2">USUARI</th>
                <th class="text-left text-caption font-weight-bold text-grey-darken-2">ACCIÓ</th>
                <th class="text-left text-caption font-weight-bold text-grey-darken-2">DETALL / RALC</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="log in filteredLogs" :key="log._id" class="item-row">
                
                <td class="text-body-2 text-grey-darken-2" style="width: 180px;">
                    <div class="d-flex align-center">
                        <v-icon icon="mdi-clock-outline" size="small" class="mr-2 text-grey-lighten-1"></v-icon>
                        {{ formatDate(log.timestamp) }}
                    </div>
                </td>
                
                <td class="text-body-2 font-weight-bold text-grey-darken-3">
                    <v-avatar color="grey-lighten-3" size="24" class="mr-2">
                        <span class="text-caption font-weight-bold text-grey-darken-2">
                            {{ log.usuari ? log.usuari.charAt(0).toUpperCase() : '?' }}
                        </span>
                    </v-avatar>
                    {{ log.usuari }}
                </td>

                <td>
                  <v-chip 
                    size="small" 
                    :color="getActionColor(log.accio)" 
                    variant="flat" 
                    class="font-weight-bold"
                    label
                  >
                    <v-icon start :icon="getActionIcon(log.accio)" size="small"></v-icon>
                    {{ cleanActionText(log.accio) }}
                  </v-chip>
                </td>

                <td class="text-body-2 text-grey-darken-1 font-mono">
                    <div class="d-flex flex-column">
                        
                        <div v-if="isTransfer(log.accio)" class="mb-1">
                             <span class="text-caption text-orange-darken-3 font-weight-bold bg-orange-lighten-5 px-2 py-1 rounded">
                                <v-icon icon="mdi-arrow-right" size="x-small" class="mr-1"></v-icon>
                                {{ extractDestination(log.accio) }}
                             </span>
                        </div>

                        <span v-if="log.ralc_alumne">
                            RALC: <strong>{{ log.ralc_alumne }}</strong>
                        </span>
                    </div>
                </td>
              </tr>
            </tbody>
          </v-table>

          <div v-if="filteredLogs.length === 0" class="text-center py-10">
            <v-icon icon="mdi-filter-off" size="48" color="grey-lighten-2" class="mb-2"></v-icon>
            <p class="text-grey-darken-1">No s'han trobat registres amb aquest filtre.</p>
          </div>

          <div class="bg-grey-lighten-5 pa-2 text-center border-t">
              <span class="text-caption text-grey">Mostrant {{ filteredLogs.length }} registres</span>
          </div>

        </v-card>

      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { onMounted, ref, computed } from 'vue';
import { useStudentStore } from '@/stores/studentStore';

const studentStore = useStudentStore();
const loading = ref(false);
const selectedFilter = ref('all'); // Filtro por defecto

const refreshData = async () => {
    loading.value = true;
    await studentStore.fetchLogs();
    loading.value = false;
};

// --- LOGICA DE FILTRADO ---
const filteredLogs = computed(() => {
    const logs = studentStore.logs;
    const filter = selectedFilter.value;

    if (filter === 'all') return logs;
    
    return logs.filter(log => {
        const action = (log.accio || '').toLowerCase();
        if (filter === 'trasllat') return action.includes('trasllat') || action.includes('transfer');
        if (filter === 'pujada') return action.includes('pujada') || action.includes('upload');
        if (filter === 'nou') return action.includes('nou') || action.includes('crear');
        return true;
    });
});

onMounted(() => {
  refreshData();
});

const formatDate = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleString('ca-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

// Helpers para Traslados
const isTransfer = (text) => {
    return (text || '').toLowerCase().includes('trasllat') || (text || '').toLowerCase().includes('transfer');
};

const cleanActionText = (text) => {
    if(!text) return '';
    // Si es traslado, simplificamos el texto del chip para que no sea enorme
    if(isTransfer(text)) return 'Trasllat de Centre';
    return text;
};

const extractDestination = (text) => {
    // Si en el backend guardamos "Trasllat a 0801234", intentamos sacar el código
    if (!text) return 'Nou Centre';
    if (text.includes(' a ')) {
        return 'A: ' + text.split(' a ')[1]; // Muestra lo que hay después de " a "
    }
    return 'Canvi de centre';
};

// --- COLORES ---
const getActionColor = (accio) => {
  if (!accio) return 'grey';
  const a = accio.toLowerCase();
  
  if (a.includes('pujada') || a.includes('upload')) return 'green-lighten-4 text-green-darken-4';
  if (a.includes('nou alumne') || a.includes('crear')) return 'blue-lighten-4 text-blue-darken-4';
  if (a.includes('trasllat') || a.includes('transfer')) return 'orange-lighten-4 text-orange-darken-4';
  if (a.includes('esborrar') || a.includes('delete') || a.includes('elimin')) return 'red-lighten-4 text-red-darken-4';
  
  return 'grey-lighten-4 text-grey-darken-2';
};

// --- ICONOS ---
const getActionIcon = (accio) => {
    if (!accio) return 'mdi-circle-small';
    const a = accio.toLowerCase();

    if (a.includes('pujada')) return 'mdi-cloud-upload';
    if (a.includes('nou alumne')) return 'mdi-account-plus';
    if (a.includes('trasllat')) return 'mdi-transfer'; // Icono específico
    if (a.includes('esborrar') || a.includes('elimin')) return 'mdi-trash-can';
    
    return 'mdi-information';
};
</script>

<style scoped>
.gencat-font {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
}

.gencat-card {
  border: 1px solid rgba(0,0,0,0.1) !important;
  background-color: white;
}

.border-red {
    border-color: #D0021B !important;
    color: #D0021B !important;
}

.font-mono {
    font-family: monospace;
}

.item-row:hover td {
    background-color: #f9f9f9 !important;
}
</style>