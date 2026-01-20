<template>
  <v-menu v-if="isAuthenticated" location="bottom end" :close-on-content-click="false" offset="14">
    <template v-slot:activator="{ props }">
      <v-btn icon v-bind="props" @click="markAsRead" variant="text" density="comfortable" class="bell-btn">
        <v-badge :content="unreadCount" :model-value="unreadCount > 0" color="#D0021B" offset-x="2" offset-y="2">
          <v-icon icon="mdi-bell-outline" color="white" size="default"></v-icon>
        </v-badge>
      </v-btn>
    </template>

    <v-card min-width="380" max-width="400" class="gencat-card" elevation="4" rounded="lg">
      <div class="d-flex justify-space-between align-center pa-4 border-b bg-white">
        <div class="d-flex align-center">
          <v-icon icon="mdi-bell-ring-outline" size="small" class="mr-2" color="#D0021B"></v-icon>
          <span class="text-subtitle-2 font-weight-bold text-grey-darken-4 text-uppercase" style="letter-spacing: 0.5px;">
            Notificacions
          </span>
        </div>
        <v-btn icon="mdi-refresh" size="x-small" variant="text" color="grey-darken-1" @click="refreshLogs" title="Actualitzar"></v-btn>
      </div>

      <v-list lines="two" max-height="400" class="overflow-y-auto py-0 bg-white">
        <div v-if="notifications.length === 0" class="d-flex flex-column align-center justify-center py-10 text-center">
          <v-icon icon="mdi-bell-sleep-outline" color="grey-lighten-2" size="40" class="mb-2"></v-icon>
          <span class="text-caption text-grey font-weight-medium">No tens notificacions noves</span>
        </div>

        <template v-else>
          <v-list-item v-for="(log, i) in notifications" :key="i" class="py-3 border-b item-hover" :class="{ 'bg-red-lighten-5': log.isNew }">
            <template v-slot:prepend>
              <v-avatar :color="log.isNew ? 'white' : 'grey-lighten-5'" size="40" class="mr-3 border" style="border-color: rgba(0,0,0,0.08) !important;">
                <v-icon :icon="getActionIcon(log.accio)" :color="log.isNew ? '#D0021B' : 'grey-darken-1'" size="small"></v-icon>
              </v-avatar>
            </template>

            <v-list-item-title class="text-body-2 font-weight-bold text-grey-darken-4 mb-1 d-flex align-center justify-space-between">
              <span>{{ cleanActionTitle(log.accio) }}</span>
              <v-icon v-if="log.isNew" icon="mdi-circle-medium" color="#D0021B" size="x-small"></v-icon>
            </v-list-item-title>

            <v-list-item-subtitle class="text-caption text-grey-darken-2 mb-1" style="opacity: 1;">
              <strong class="text-black">{{ log.usuari || 'Usuari' }}</strong> - {{ getDetailText(log) }}
            </v-list-item-subtitle>

            <template v-slot:append>
              <span class="text-caption text-grey-lighten-1 mt-1" style="font-size: 0.7rem !important; white-space: nowrap;">
                {{ formatTime(log.timestamp) }}
              </span>
            </template>
          </v-list-item>
        </template>
      </v-list>

      <div v-if="notifications.length > 0" class="pa-2 bg-grey-lighten-5 border-t text-center">
        <v-btn variant="text" size="small" color="grey-darken-3" class="text-caption font-weight-bold text-none" @click="$router.push('/logs')">
          Veure tot l'historial
        </v-btn>
      </div>
    </v-card>
  </v-menu>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { io } from 'socket.io-client'; // <--- 1. IMPORTAR SOCKET

const logs = ref([]);
const lastReadTimestamp = ref(0);
const isAuthenticated = ref(false);
let socket = null; // Variable para controlar la conexión

// Helper para detectar login
const checkAuth = () => !!localStorage.getItem('token');

const loadLastRead = () => {
  const stored = localStorage.getItem('lastNotificationRead');
  lastReadTimestamp.value = stored ? parseInt(stored) : Date.now();
};

// --- 2. LÓGICA DE FILTRADO EXTRAÍDA (Para reusar en Fetch y Socket) ---
const shouldShowLog = (log) => {
  const myCenterCode = localStorage.getItem('userCenterCode'); 
  const myEmail = localStorage.getItem('userEmail');

  // A. Solo Altas y Traslados
  const isTypeRelevant = log.accio.includes('Nou Alumne') || log.accio.includes('Trasllat');
  if (!isTypeRelevant) return false;

  // B. Si es admin (no tiene código), ve todo
  if (!myCenterCode) return true;

  // C. Si la acción la hice YO, la veo
  if (log.usuari === myEmail) return true;

  // D. Si el texto contiene mi código de centro, lo veo
  if (log.accio.includes(myCenterCode)) return true;

  return false;
};

// --- 3. CARGA INICIAL (Historial) ---
const fetchLogs = async () => {
  if (!isAuthenticated.value) return; 

  try {
    const res = await fetch('http://localhost:3001/api/logs');
    if (res.ok) {
      const data = await res.json();
      
      // Usamos el filtro extraído
      logs.value = data
        .filter(shouldShowLog)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 10);
    }
  } catch (e) {
    console.error("Error fetching notifications", e);
  }
};

// --- 4. CONFIGURACIÓN WEBSOCKET (En vivo) ---
const initWebSocket = () => {
  console.log('🔌 Intentando conectar al Socket...'); // LOG 1

  socket = io('http://localhost:3001'); // Asegúrate que este puerto es correcto

  socket.on('connect', () => {
    console.log('✅ ¡CONECTADO AL SOCKET! ID:', socket.id); // LOG 2
  });

  socket.on('connect_error', (err) => {
    console.error('❌ Error de conexión Socket:', err); // LOG 3
  });

  socket.on('new_notification', (newLog) => {
    console.log('📩 Notificación recibida:', newLog); // LOG 4
    
    // Tu lógica de filtro...
    if (shouldShowLog(newLog)) {
        console.log('👀 ¡Es para mí! Mostrando...');
        logs.value.unshift(newLog);
        if (logs.value.length > 10) logs.value.pop();
    } else {
        console.log('🙈 Ignorada por filtros.');
    }
  });
};

// --- COMPUTADAS Y HELPERS VISUALES (Igual que antes) ---
const notifications = computed(() => {
  return logs.value.map(log => {
    const logTime = new Date(log.timestamp).getTime();
    return {
      ...log,
      isNew: logTime > lastReadTimestamp.value
    };
  });
});

const unreadCount = computed(() => notifications.value.filter(n => n.isNew).length);

const markAsRead = () => {
  const now = Date.now();
  lastReadTimestamp.value = now;
  localStorage.setItem('lastNotificationRead', now.toString());
};

const refreshLogs = () => fetchLogs();

const formatTime = (isoString) => {
  const date = new Date(isoString);
  const isToday = new Date().toDateString() === date.toDateString();
  if (isToday) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const getActionIcon = (action) => {
  if (action.includes('Nou')) return 'mdi-account-plus';
  if (action.includes('Trasllat')) return 'mdi-transfer';
  return 'mdi-information-variant';
};

const cleanActionTitle = (action) => {
    if (action.includes('Trasllat')) return 'Trasllat d\'Alumne';
    if (action.includes('Nou Alumne')) return 'Alta d\'Expedient';
    return action;
};

const getDetailText = (log) => {
  if (log.accio.includes('Trasllat')) {
    const parts = log.accio.split(' a ');
    const dest = parts.length > 1 ? parts[1] : 'Nou Centre';
    return `enviat a: ${dest}`;
  }
  return `ha registrat RALC: ${log.ralc_alumne}`;
};

// --- LIFECYCLE ---
onMounted(() => {
  isAuthenticated.value = checkAuth();
  if (isAuthenticated.value) {
    loadLastRead();
    fetchLogs();     // Cargar historial antiguo
    initWebSocket(); // <--- Iniciar escucha en tiempo real
  }
});

onUnmounted(() => {
  if (socket) socket.disconnect(); // Desconectar al salir para no dejar procesos abiertos
});
</script>

<style scoped>
.bell-btn:hover :deep(.v-icon) {
  opacity: 0.8;
}

.gencat-card {
  border: 1px solid rgba(0, 0, 0, 0.08) !important;
  background-color: white !important;
}

.v-list::-webkit-scrollbar {
  width: 5px;
}

.v-list::-webkit-scrollbar-track {
  background: white;
}

.v-list::-webkit-scrollbar-thumb {
  background: #e0e0e0;
  border-radius: 4px;
}

.item-hover:hover {
  background-color: #f9f9f9;
}
</style>