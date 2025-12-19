// src/stores/studentStore.js
import { defineStore } from 'pinia';

export const useStudentStore = defineStore('student', {
  // 1. STATE
  state: () => ({
    students: [],
    logs: [],
    loading: false,
    error: null,
  }),

  // 2. ACTIONS
  actions: { // <--- ABRE ACTIONS
    
    // Acción A: Fetch
    async fetchStudents() {
        const response = await fetch('http://localhost:3001/api/students'); 
        
        if (!response.ok) {
            console.error("Error del servidor:", response.status, response.statusText);
            const text = await response.text();
            console.error("Respuesta texto:", text);
            throw new Error('Server error');
        }

        const data = await response.json();
        this.students = data;
    }, // <--- OJO AQUÍ: Solo cerramos la función y ponemos coma, NO cerramos actions todavía

    async fetchLogs() {
        try {
            const response = await fetch('http://localhost:3001/api/logs');
            this.logs = await response.json();
        } catch (e) {
            this.error = "Error carregant els logs";
        }
    },

    async uploadStudentPI(file, studentHash) {
      this.loading = true;
      try {
        const formData = new FormData();
        // Agafem l'email de l'usuari loguejat del localStorage
        const userEmail = localStorage.getItem('userEmail') || 'desconegut';

        formData.append('studentHash', studentHash);
        formData.append('userEmail', userEmail); // <--- IMPORTANT per al log
        formData.append('documento_pi', file); 

        const response = await fetch('http://localhost:3001/api/upload', {
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
    }
  }
});