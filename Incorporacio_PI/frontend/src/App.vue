<template>
  <v-app>
    <v-app-bar color="primary" elevation="2">
      <v-app-bar-title>
        <v-icon icon="mdi-school" class="mr-2"></v-icon>
        Plataforma Normalització PI
      </v-app-bar-title>
    </v-app-bar>

    <v-main class="bg-grey-lighten-4">
      <v-container>
        <StudentList />
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup>
// Importamos el componente de la lista
import StudentList from './components/StudentList.vue';
</script>

<style>
/* Opcional: algún ajuste global */
</style>