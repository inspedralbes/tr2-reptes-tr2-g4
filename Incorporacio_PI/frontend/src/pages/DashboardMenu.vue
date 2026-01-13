<template>
  <v-container class="fill-height bg-grey-lighten-5">
    <v-row justify="center" align="center">
      
      <v-col cols="12" class="text-center mb-10">
        <h1 class="text-h4 font-weight-black text-grey-darken-4 mb-2 gencat-font">
          Tauler de Control
        </h1>
        <p class="text-subtitle-1 text-grey-darken-1">
          Selecciona una operació per començar
        </p>
      </v-col>

      <v-col cols="12" md="5" lg="4">
        <v-card
          class="pa-8 text-center cursor-pointer gencat-card hover-card h-100 d-flex flex-column justify-center align-center"
          elevation="1"
          rounded="lg"
          @click="$router.push('/alumnos')"
        >
          <div class="icon-container bg-blue-lighten-5 mb-6">
            <v-icon icon="mdi-format-list-bulleted" size="48" color="blue-darken-3"></v-icon>
          </div>
          
          <h2 class="text-h5 font-weight-bold text-grey-darken-3 mb-3">
            Gestió d'Alumnes
          </h2>
          <p class="text-body-2 text-grey-darken-1 px-4">
            Accedeix al llistat complet per consultar, cercar i gestionar els Plans Individualitzats (PI).
          </p>
        </v-card>
      </v-col>

      <v-col cols="12" md="5" lg="4">
        <v-card
          class="pa-8 text-center cursor-pointer gencat-card hover-card h-100 d-flex flex-column justify-center align-center"
          elevation="1"
          rounded="lg"
          @click="$router.push('/nuevo-alumno')"
        >
          <div class="icon-container bg-green-lighten-5 mb-6">
            <v-icon icon="mdi-account-plus" size="48" color="green-darken-3"></v-icon>
          </div>
          
          <h2 class="text-h5 font-weight-bold text-grey-darken-3 mb-3">
            Alta d'Alumne
          </h2>
          <p class="text-body-2 text-grey-darken-1 px-4">
            Registra un nou alumne a la base de dades i assigna el centre corresponent.
          </p>
        </v-card>
      </v-col>

    </v-row>
  </v-container>
</template>

<style scoped>
/* Tipografia corporativa */
.gencat-font {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
}

/* Estil base de les targetes */
.gencat-card {
  border: 1px solid rgba(0,0,0,0.1) !important;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

/* Contenidor de la icona: més petit i discret que abans */
.icon-container {
  width: 90px;
  height: 90px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.3s ease;
}

/* Efecte HOVER: Vora vermella i lleugera elevació */
.hover-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 16px rgba(0,0,0,0.08) !important;
  border-color: #D0021B !important; /* Vora vermella Gencat */
}

/* Efecte extra: la icona creix una mica al passar el ratolí */
.hover-card:hover .icon-container {
  transform: scale(1.1);
}

.cursor-pointer {
  cursor: pointer;
}
</style>