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
                Auditoria i Seguretat
                </h1>
                <div class="text-caption text-grey-darken-1">
                Monitoratge d'accessos i activitat del sistema
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
                <v-chip filter value="seguretat" variant="outlined" color="red-darken-3" size="small">
                    <v-icon start icon="mdi-shield-alert" size="small"></v-icon> Seguretat
                </v-chip>
                <v-chip filter value="login" variant="outlined" color="teal-darken-3" size="small">
                    <v-icon start icon="mdi-login" size="small"></v-icon> Accessos
                </v-chip>
                <v-chip filter value="alumnes" variant="outlined" color="blue-darken-3" size="small">
                    <v-icon start icon="mdi-account-school" size="small"></v-icon> Alumnes
                </v-chip>
                <v-chip filter value="trasllat" variant="outlined" color="orange-darken-4" size="small">
                    <v-icon start icon="mdi-transfer" size="small"></v-icon> Trasllats
                </v-chip>
                <v-chip filter value="pujada" variant="outlined" color="green-darken-3" size="small">
                    <v-icon start icon="mdi-cloud-upload" size="small"></v-icon> Pujades
                </v-chip>
                <v-chip filter value="ia" variant="outlined" color="purple-darken-3" size="small">
                    <v-icon start icon="mdi-robot-outline" size="small"></v-icon> IA
                </v-chip>
            </v-chip-group>
        </div>

        <v-card class="gencat-card" elevation="0" rounded="lg">
          
          <v-table density="comfortable" hover>
            <thead>
              <tr class="bg-grey-lighten-4">
                <th class="text-left text-caption font-weight-bold text-grey-darken-2 py-3">DATA I HORA</th>
                <th class="text-left text-caption font-weight-bold text-grey-darken-2">USUARI / IP</th>
                <th class="text-left text-caption font-weight-bold text-grey-darken-2">ESDEVENIMENT</th>
                <th class="text-left text-caption font-weight-bold text-grey-darken-2">DETALLS</th>
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
                    <v-avatar :color="getUserColor(log.usuari)" size="24" class="mr-2">
                        <v-icon v-if="log.usuari && log.usuari.includes('IP')" icon="mdi-web" size="14" color="white"></v-icon>
                        <span v-else class="text-caption font-weight-bold text-white">
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

                        <span v-if="isSecurityEvent(log.accio)" class="text-caption text-red font-weight-bold">
                            ⚠️ {{ log.ralc_alumne }}
                        </span>

                        <span v-else-if="log.ralc_alumne && log.ralc_alumne !== 'N/A'">
                            {{ log.ralc_alumne }}
                        </span>
                    </div>
                </td>
              </tr>
            </tbody>
          </v-table>

          <div v-if="filteredLogs.length === 0" class="text-center py-10">
            <v-icon icon="mdi-shield-check" size="48" color="grey-lighten-2" class="mb-2"></v-icon>
            <p class="text-grey-darken-1">Tot correcte. No hi ha registres per a aquest filtre.</p>
          </div>

          <div class="bg-grey-lighten-5 pa-2 text-center border-t">
              <span class="text-caption text-grey">Mostrant {{ filteredLogs.length }} esdeveniments</span>
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
const selectedFilter = ref('all');

const refreshData = async () => {
    loading.value = true;
    await studentStore.fetchLogs();
    loading.value = false;
};

const filteredLogs = computed(() => {
    const logs = studentStore.logs;
    const filter = selectedFilter.value;

    if (filter === 'all') return logs;
    
    return logs.filter(log => {
        const action = (log.accio || '').toLowerCase();
        
        if (filter === 'seguretat') return action.includes('bloqueig') || action.includes('fallit') || action.includes('seguretat');
        if (filter === 'login') return action.includes('login correcte') || action.includes('accés');
        if (filter === 'alumnes') return action.includes('nou') || action.includes('crear') || action.includes('alumne');
        if (filter === 'trasllat') return action.includes('trasllat') || action.includes('transfer');
        if (filter === 'pujada') return action.includes('pujada') || action.includes('upload');
        // AÑADIDO DE PROVA: Filtro IA
        if (filter === 'ia') return action.includes('ai:') || action.includes('ia:') || action.includes('resum');
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

// --- HELPERS ---

const isTransfer = (text) => {
    return (text || '').toLowerCase().includes('trasllat') || (text || '').toLowerCase().includes('transfer');
};

const isSecurityEvent = (text) => {
    return (text || '').toLowerCase().includes('bloqueig') || (text || '').toLowerCase().includes('seguretat');
};

const cleanActionText = (text) => {
    if(!text) return '';
    if(isTransfer(text)) return 'Trasllat de Centre';
    if(text.includes('Bloqueig')) return 'Bloqueig Preventiu';
    // AÑADIDO DE PROVA: Texto IA
    if(text.includes('AI:') || text.includes('IA:')) return 'Resum IA Generat';
    return text;
};

const extractDestination = (text) => {
    if (!text) return 'Nou Centre';
    if (text.includes(' a ')) {
        return 'A: ' + text.split(' a ')[1]; 
    }
    return 'Canvi de centre';
};

// --- COLORES & ESTILS ---

const getUserColor = (user) => {
    if (!user) return 'grey-lighten-2';
    if (user.includes('IP')) return 'blue-grey-darken-3'; // Color fosc per IPs
    return 'grey-lighten-1';
};

const getActionColor = (accio) => {
  if (!accio) return 'grey';
  const a = accio.toLowerCase();
  
  if (a.includes('bloqueig')) return 'red-darken-4 text-white'; 
  if (a.includes('fallit')) return 'orange-lighten-4 text-orange-darken-4';
  
  if (a.includes('login correcte')) return 'teal-lighten-4 text-teal-darken-4';
  
  if (a.includes('pujada')) return 'green-lighten-4 text-green-darken-4';
  if (a.includes('nou alumne')) return 'blue-lighten-4 text-blue-darken-4';
  if (a.includes('trasllat')) return 'orange-lighten-4 text-orange-darken-4';
  if (a.includes('elimin')) return 'red-lighten-4 text-red-darken-4';
  // AÑADIDO DE PROVA: Color IA
  if (a.includes('ia:') || a.includes('ai:')) return 'purple-lighten-4 text-purple-darken-4';
  
  return 'grey-lighten-4 text-grey-darken-2';
};

const getActionIcon = (accio) => {
    if (!accio) return 'mdi-circle-small';
    const a = accio.toLowerCase();

    if (a.includes('bloqueig')) return 'mdi-shield-lock';
    if (a.includes('login correcte')) return 'mdi-check-decagram';
    if (a.includes('pujada')) return 'mdi-cloud-upload';
    if (a.includes('nou alumne')) return 'mdi-account-plus';
    if (a.includes('trasllat')) return 'mdi-transfer'; 
    if (a.includes('elimin')) return 'mdi-trash-can';
    // AÑADIDO DE PROVA: Icono IA
    if (a.includes('ia:') || a.includes('ai:')) return 'mdi-robot-outline';
    
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