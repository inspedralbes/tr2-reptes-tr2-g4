// src/stores/studentStore.js
import { defineStore } from 'pinia';

export const useStudentStore = defineStore('student', {
  // 1. STATE
  state: () => ({
    students: [],
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

    // Acción B: Subir el PDF
    async uploadStudentPI(file, studentHash) {
      this.loading = true;
      try {
        const formData = new FormData();

        formData.append('studentHash', studentHash);
        formData.append('documento_pi', file); 

        const response = await fetch('http://localhost:3001/api/upload', {
          method: 'POST',
          body: formData, 
        });
        
        const result = await response.json();

        if (result.success) {
          await this.fetchStudents();
          return true;
        } else {
          throw new Error(result.message);
        }

      } catch (err) {
        console.error('Error subiendo fichero:', err);
        this.error = err.message;
        return false;
      } finally {
        this.loading = false;
      }
    }
  } // <--- AQUÍ ES DONDE SE CIERRA ACTIONS FINALMENTE
});