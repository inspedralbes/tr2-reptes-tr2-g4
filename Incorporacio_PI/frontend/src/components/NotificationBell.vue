<template>
  <v-menu location="bottom end" :close-on-content-click="false">
    <template v-slot:activator="{ props }">
      <v-btn icon v-bind="props" @click="markAsRead">
        <v-badge
          :content="unreadCount"
          :model-value="unreadCount > 0"
          color="red"
          floating
        >
          <v-icon icon="mdi-bell-outline"></v-icon>
        </v-badge>
      </v-btn>
    </template>

    <v-card min-width="300" max-width="400">
      <v-card-title class="text-subtitle-1 font-weight-bold d-flex justify-space-between align-center">
        Notificacions
        <v-btn size="x-small" variant="text" color="primary" @click="refreshLogs">Actualitzar</v-btn>
      </v-card-title>
      
      <v-divider></v-divider>

      <v-list lines="two" max-height="300" class="overflow-y-auto">
        <div v-if="notifications.length === 0" class="pa-4 text-center text-grey text-caption">
          No hi ha notificaciones recents
        </div>

        <v-list-item v-for="(log, i) in notifications" :key="i">
          <template v-slot:prepend>
            <v-icon 
              :icon="log.accio === 'Nou Alumne' ? 'mdi-account-plus' : 'mdi-information'" 
              :color="log.isNew ? 'green' : 'grey'"
            ></v-icon>
          </template>

          <v-list-item-title :class="{'font-weight-bold': log.isNew}">
            {{ log.accio }}
          </v-list-item-title>
          
          <v-list-item-subtitle>
            {{ log.usuari }} - {{ log.ralc_alumne }}
          </v-list-item-subtitle>
          
          <template v-slot:append>
            <span class="text-caption text-grey">{{ formatTime(log.timestamp) }}</span>
          </template>
        </v-list-item>
      </v-list>
    </v-card>
  </v-menu>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';

const logs = ref([]);
const lastReadTimestamp = ref(0); // Fecha (en ms) de la última vez que abrimos la campana
let pollingInterval = null;

// Cargamos de localStorage la última vez que el usuario miró
const loadLastRead = () => {
  const stored = localStorage.getItem('lastNotificationRead');
  lastReadTimestamp.value = stored ? parseInt(stored) : Date.now();
};

// Pedimos logs al servidor
const fetchLogs = async () => {
  try {
    const res = await fetch('http://localhost:3001/api/logs');
    if (res.ok) {
      const data = await res.json();
      // Filtramos solo lo que nos interesa (ej: creacion de alumnos)
      // O mostramos todo. Aquí filtramos por 'Nou Alumne' para tu ejemplo
      logs.value = data.filter(l => l.accio === 'Nou Alumne');
    }
  } catch (e) {
    console.error("Error fetching logs", e);
  }
};

// Calculamos cuáles son "nuevos" comparando con lastReadTimestamp
const notifications = computed(() => {
  return logs.value.map(log => {
    const logTime = new Date(log.timestamp).getTime();
    return {
      ...log,
      isNew: logTime > lastReadTimestamp.value // Marca como nuevo si es posterior a la última lectura
    };
  });
});

// Contador para la burbuja roja
const unreadCount = computed(() => {
  return notifications.value.filter(n => n.isNew).length;
});

// Cuando el usuario hace clic en la campana
const markAsRead = () => {
  // Actualizamos el timestamp al momento actual
  const now = Date.now();
  lastReadTimestamp.value = now;
  localStorage.setItem('lastNotificationRead', now.toString());
};

const refreshLogs = () => {
  fetchLogs();
};

const formatTime = (isoString) => {
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

onMounted(() => {
  loadLastRead();
  fetchLogs();
  
  // Polling: Comprobar cada 15 segundos si hay cosas nuevas
  pollingInterval = setInterval(fetchLogs, 15000);
});

onUnmounted(() => {
  if (pollingInterval) clearInterval(pollingInterval);
});
</script>