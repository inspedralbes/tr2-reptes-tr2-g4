<template>
  <v-container>
    <v-card elevation="2" class="pa-4">
      <v-card-title class="d-flex align-center">
        <v-icon icon="mdi-history" class="me-2" color="primary"></v-icon>
        Registre d'Accessos al Sistema (#30)
        <v-spacer></v-spacer>
        <v-btn icon="mdi-refresh" variant="text" @click="studentStore.fetchLogs"></v-btn>
      </v-card-title>

      <v-divider class="mb-4"></v-divider>

      <v-table hover>
        <thead>
          <tr>
            <th class="text-left">Data i Hora</th>
            <th class="text-left">Usuari</th>
            <th class="text-left">Acció</th>
            <th class="text-left">RALC Alumne</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="log in studentStore.logs" :key="log._id">
            <td class="text-caption">{{ formatDate(log.timestamp) }}</td>
            <td><strong>{{ log.usuari }}</strong></td>
            <td>
              <v-chip size="small" :color="getActionColor(log.accio)" variant="tonal">
                {{ log.accio }}
              </v-chip>
            </td>
            <td class="text-grey">{{ log.ralc_alumne }}</td>
          </tr>
        </tbody>
      </v-table>
      
      <v-card-text v-if="studentStore.logs.length === 0" class="text-center text-grey">
        No hi ha registres d'activitat.
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup>
const studentStore = useStudentStore();

onMounted(() => {
  studentStore.fetchLogs();
});

const formatDate = (date) => {
  return new Date(date).toLocaleString('ca-ES');
};

const getActionColor = (accio) => {
  if (accio.includes('Pujada')) return 'success';
  if (accio.includes('Login')) return 'info';
  return 'grey';
};
</script>