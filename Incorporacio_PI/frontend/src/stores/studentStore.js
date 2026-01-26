import { defineStore } from 'pinia';

const BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:3001');

const API_URL = `${BASE_URL}/api`;

export const useStudentStore = defineStore('student', {
  state: () => ({
    students: [],
    logs: [],
    loading: false,
    error: null,
  }),

  actions: { 
    
    async fetchStudents() {
        const response = await fetch(`${API_URL}/students?_t=${Date.now()}`); 
        
        if (!response.ok) {
            console.error("Error del servidor:", response.status);
            throw new Error('Server error');
        }

        const data = await response.json();
        this.students = data;
    }, 

    async fetchLogs() {
        try {
            const response = await fetch(`${API_URL}/logs`);
            this.logs = await response.json();
        } catch (e) {
            this.error = "Error carregant els logs";
        }
    },

    async uploadStudentPI(file, studentHash) {
      this.loading = true;
      try {
        const formData = new FormData();
        const userEmail = localStorage.getItem('userEmail') || 'desconegut';

        formData.append('studentHash', studentHash);
        formData.append('userEmail', userEmail); 
        formData.append('documento_pi', file); 

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

    async deleteFile(studentHash, filename) {
      this.loading = true;
      try {
        const userEmail = localStorage.getItem('userEmail') || 'desconegut';

        const response = await fetch(`${API_URL}/students/${studentHash}/files/${filename}`, {
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