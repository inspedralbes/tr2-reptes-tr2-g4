// src/stores/studentStore.js
import { defineStore } from 'pinia';

export const useStudentStore = defineStore('student', {
  // 1. STATE: Tus variables (datos)
  state: () => ({
    students: [], // Lista de alumnos
    loading: false,
    error: null,
  }),

  // 2. ACTIONS: Tus funciones (llamadas al server)
  actions: {
    // Acción A: Obtener lista de alumnos
    async fetchStudents() {
      this.loading = true;
      try {
        const response = await fetch('http://localhost:3000/api/students');
        const data = await response.json();
        this.students = data; // Guardamos los datos en el estado
      } catch (err) {
        console.error('Error al cargar alumnos:', err);
        this.error = 'No se pudo cargar la lista';
      } finally {
        this.loading = false;
      }
    },

    // Acción B: Subir el PDF (AQUÍ VA TU CÓDIGO)
    async uploadStudentPI(file, studentHash) {
      this.loading = true;
      try {
        const formData = new FormData();
        // 'documento_pi' debe coincidir con upload.single('documento_pi') del server.js
        formData.append('documento_pi', file); 
        formData.append('studentHash', studentHash);

        const response = await fetch('http://localhost:3000/api/upload', {
          method: 'POST',
          body: formData, 
          // NOTA: Fetch detecta FormData y pone el Content-Type correcto automáticamente
        });
        
        const result = await response.json();

        if (result.success) {
          // Si todo ha ido bien, recargamos la lista para que salga el icono verde
          await this.fetchStudents();
          return true; // Devolvemos true para que el componente sepa que funcionó
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
  }
});