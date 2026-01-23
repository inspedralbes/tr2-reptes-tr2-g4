<template>
  <div class="logs-container">
    <h2>Registre d'Accessos (#30)</h2>
    <button @click="fetchLogs" class="btn-refresh">Actualitzar</button>
    
    <table class="logs-table">
      <thead>
        <tr>
          <th>Data i Hora</th>
          <th>Usuari (Centre)</th>
          <th>Alumne (RALC)</th>
          <th>Acció</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="log in logs" :key="log._id">
          <td>{{ formatDate(log.data) }}</td>
          <td>{{ log.usuari }}</td>
          <td>{{ log.ralc_alumne }}</td>
          <td><span class="badge">{{ log.accio }}</span></td>
        </tr>
        <tr v-if="logs.length === 0">
          <td colspan="4">No hi ha accessos registrats.</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script>
export default {
  data() {
    return {
      logs: []
    };
  },
  mounted() {
    this.fetchLogs();
  },
  methods: {
    async fetchLogs() {
      try {
        const response = await fetch('http://localhost:4002/api/logs');
        this.logs = await response.json();
      } catch (error) {
        console.error("Error carregant logs:", error);
      }
    },
    formatDate(dateString) {
      const options = { 
        year: 'numeric', month: 'short', day: 'numeric', 
        hour: '2-digit', minute: '2-digit', second: '2-digit' 
      };
      return new Date(dateString).toLocaleDateString('ca-ES', options);
    }
  }
};
</script>

<style scoped>
.logs-container { padding: 20px; font-family: sans-serif; }
.logs-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
.logs-table th, .logs-table td { 
  border: 1px solid #ddd; padding: 12px; text-align: left; 
}
.logs-table th { background-color: #f4f4f9; color: #333; }
.btn-refresh { 
  padding: 8px 15px; background: #4a90e2; color: white; 
  border: none; border-radius: 4px; cursor: pointer; 
}
.badge { 
  background: #e1f5fe; color: #01579b; 
  padding: 4px 8px; border-radius: 4px; font-size: 0.85em; 
}
</style>