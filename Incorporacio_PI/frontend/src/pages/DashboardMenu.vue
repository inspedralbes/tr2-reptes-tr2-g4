<template>
  <v-container class="fill-height bg-grey-lighten-5">
    <v-row justify="center" align="center">
      <v-col cols="12" class="text-center mb-8">
        <h1 class="text-h3 font-weight-bold text-primary">¿Qué quieres hacer hoy?</h1>
        <p class="text-subtitle-1 text-grey-darken-1">Selecciona una opción para continuar</p>
      </v-col>

      <v-col cols="12" md="5" lg="4">
        <v-card
          class="pa-8 text-center cursor-pointer hover-card"
          elevation="4"
          rounded="xl"
          @click="$router.push('/alumnos')"
        >
          <v-avatar color="blue-lighten-5" size="120" class="mb-6">
            <v-icon icon="mdi-format-list-bulleted" size="60" color="blue-darken-2"></v-icon>
          </v-avatar>
          <h2 class="text-h4 font-weight-bold mb-2">Ver Alumnos</h2>
          <p class="text-body-1 text-grey">Consulta, busca y gestiona los PIs de los alumnos existentes.</p>
        </v-card>
      </v-col>

      <v-col cols="12" md="5" lg="4">
        <v-card
          class="pa-8 text-center cursor-pointer hover-card"
          elevation="4"
          rounded="xl"
          @click="$router.push('/nuevo-alumno')"
        >
          <v-avatar color="green-lighten-5" size="120" class="mb-6">
            <v-icon icon="mdi-account-plus" size="60" color="green-darken-2"></v-icon>
          </v-avatar>
          <h2 class="text-h4 font-weight-bold mb-2">Nuevo Alumno</h2>
          <p class="text-body-1 text-grey">Registra un nuevo alumno en la base de datos.</p>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
.hover-card {
  transition: transform 0.2s, box-shadow 0.2s;
}
.hover-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 10px 20px rgba(0,0,0,0.1) !important;
}
</style>