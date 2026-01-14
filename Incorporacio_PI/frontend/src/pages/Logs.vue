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
                Auditoria i Registre d'Activitat
                </h1>
                <div class="text-caption text-grey-darken-1">
                Històric dels darrers moviments registrats a la plataforma (#30)
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
            Actualitzar Dades
          </v-btn>
        </div>

        <v-card class="gencat-card" elevation="0" rounded="lg">
          
          <v-table density="comfortable" hover>
            <thead>
              <tr class="bg-grey-lighten-4">
                <th class="text-left text-caption font-weight-bold text-grey-darken-2 py-3">DATA I HORA</th>
                <th class="text-left text-caption font-weight-bold text-grey-darken-2">USUARI</th>
                <th class="text-left text-caption font-weight-bold text-grey-darken-2">TIPUS D'ACCIÓ</th>
                <th class="text-left text-caption font-weight-bold text-grey-darken-2">DETALL / RALC</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="log in studentStore.logs" :key="log._id" class="item-row">
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
                    {{ log.accio }}
                  </v-chip>
                </td>

                <td class="text-body-2 text-grey-darken-1 font-mono">
                    <span v-if="log.ralc_alumne">
                        RALC: {{ log.ralc_alumne }}
                    </span>
                    <span v-else class="text-caption text-grey-lighten-1">
                        -
                    </span>
                </td>
              </tr>
            </tbody>
          </v-table>

          <div v-if="studentStore.logs.length === 0" class="text-center py-10">
            <v-icon icon="mdi-history" size="48" color="grey-lighten-2" class="mb-2"></v-icon>
            <p class="text-grey-darken-1">No hi ha registres d'activitat recents.</p>
          </div>

          <div class="bg-grey-lighten-5 pa-2 text-center border-t">
              <span class="text-caption text-grey">Mostrant els últims 30 registres</span>
          </div>

        </v-card>

      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useStudentStore } from '@/stores/studentStore';

const studentStore = useStudentStore();
const loading = ref(false);

const refreshData = async () => {
    loading.value = true;
    await studentStore.fetchLogs();
    loading.value = false;
};

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

// --- LOGICA DE COLORS CORREGIDA ---
const getActionColor = (accio) => {
  if (!accio) return 'grey';
  const a = accio.toLowerCase();
  
  // VERDE: Subidas
  if (a.includes('pujada') || a.includes('upload')) return 'green-lighten-4 text-green-darken-4';
  
  // AZUL: Creación
  if (a.includes('nou alumne') || a.includes('crear')) return 'blue-lighten-4 text-blue-darken-4';
  
  // NARANJA: Movimientos
  if (a.includes('trasllat') || a.includes('transfer')) return 'orange-lighten-4 text-orange-darken-4';
  
  // ROJO: Eliminación (CORREGIDO: detecta "elimin" para cubrir "eliminació")
  if (a.includes('esborrar') || a.includes('delete') || a.includes('elimin')) {
      return 'red-lighten-4 text-red-darken-4';
  }
  
  // GRIS CLARO: Login
  if (a.includes('login')) return 'grey-lighten-3 text-grey-darken-3';
  
  // DEFECTO
  return 'grey-lighten-4 text-grey-darken-2';
};

// --- LOGICA DE ICONOS CORREGIDA ---
const getActionIcon = (accio) => {
    if (!accio) return 'mdi-circle-small';
    const a = accio.toLowerCase();

    if (a.includes('pujada')) return 'mdi-cloud-upload';
    if (a.includes('nou alumne')) return 'mdi-account-plus';
    if (a.includes('trasllat')) return 'mdi-transfer';

    if (a.includes('esborrar') || a.includes('delete') || a.includes('elimin')) {
        return 'mdi-trash-can';
    }
    
    if (a.includes('login')) return 'mdi-login';
    
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