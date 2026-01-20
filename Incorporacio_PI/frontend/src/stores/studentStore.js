// src/stores/studentStore.js
import { defineStore } from 'pinia';

// 1. DEFINIMOS LA URL BASE CORRECTA (Producción o Local)
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const API_URL = `${BASE_URL}/api`;

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
        // CORREGIDO: Usamos API_URL
        const response = await fetch(`${API_URL}/students?_t=${Date.now()}`); 
        
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
            // CORREGIDO: Usamos API_URL
            const response = await fetch(`${API_URL}/logs`);
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

        // CORREGIDO: Usamos API_URL
        const response = await fetch(`${API_URL}/upload`, {
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
        // 1. Recuperem l'email per al log
        const userEmail = localStorage.getItem('userEmail') || 'desconegut';

        // 2. Fem la petició
        // CORREGIDO: Usamos API_URL
        const response = await fetch(`${API_URL}/students/${studentHash}/files/${filename}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json' // Important per poder enviar el body
          },
          // 3. Enviem l'email al cos de la petició
          body: JSON.stringify({ userEmail: userEmail })
        });

        const result = await response.json();

        if (result.success) {
          // 4. Si va bé, actualitzem la llista i els logs
          await this.fetchStudents();
          // Opcional: recarregar logs si estem a la pantalla de logs
          // await this.fetchLogs(); 
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