import { defineStore } from 'pinia';

// 1. DEFINIMOS LA URL BASE
// Si existe la variable de entorno (en el servidor), usa esa. 
// Si no (en tu PC), usa localhost:3001.
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const useStudentStore = defineStore('student', {
  // 1. STATE
  state: () => ({
    students: [],
    logs: [],
    loading: false,
    error: null,
  }),

  // 2. ACTIONS
  actions: { 
    
    // Acción A: Fetch Students
    async fetchStudents() {
        // CAMBIO AQUÍ: Usamos API_URL
        const response = await fetch(`${API_URL}/api/students?_t=${Date.now()}`); 
        
        if (!response.ok) {
            console.error("Error del servidor:", response.status);
            throw new Error('Server error');
        }

        const data = await response.json();
        this.students = data;
    }, 

    // Acción B: Fetch Logs
    async fetchLogs() {
        try {
            // CAMBIO AQUÍ: Usamos API_URL
            const response = await fetch(`${API_URL}/api/logs`);
            this.logs = await response.json();
        } catch (e) {
            this.error = "Error carregant els logs";
        }
    },

    // Acción C: Upload
    async uploadStudentPI(file, studentHash) {
      this.loading = true;
      try {
        const formData = new FormData();
        const userEmail = localStorage.getItem('userEmail') || 'desconegut';

        formData.append('studentHash', studentHash);
        formData.append('userEmail', userEmail); 
        formData.append('documento_pi', file); 

        // CAMBIO AQUÍ: Usamos API_URL
        const response = await fetch(`${API_URL}/api/upload`, {
          method: 'POST',
          body: formData, 
        });
        
        const result = await response.json();
        if (result.success) {
          await this.fetchStudents();
          return true;
        }
        throw new Error('Error al pujar');
      } catch (err) {
        this.error = err.message;
        return false;
      } finally {
        this.loading = false;
      }
    },

    // --- NOVA ACCIÓ: DELETE FILE ---
    async deleteFile(studentHash, filename) {
      this.loading = true;
      try {
        const userEmail = localStorage.getItem('userEmail') || 'desconegut';

        // CAMBIO AQUÍ: Usamos API_URL
        const response = await fetch(`${API_URL}/api/students/${studentHash}/files/${filename}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ userEmail: userEmail })
        });

        const result = await response.json();

        if (result.success) {
          await this.fetchStudents();
          return true;
        } else {
          throw new Error('No s\'ha pogut esborrar');
        }

      } catch (err) {
        console.error(err);
        this.error = err.message;
        return false;
      } finally {
        this.loading = false;
      }
    }
  }
});