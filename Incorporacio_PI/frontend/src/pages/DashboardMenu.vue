<template>
  <v-container class="fill-height align-start bg-grey-lighten-5" fluid>
    <v-row justify="center" class="mt-4">
      <v-col cols="12" lg="10" xl="9">

        <div class="mb-8">
          <h1 class="text-h4 font-weight-black text-grey-darken-3 gencat-font mb-2">
            Tauler de Control
          </h1>
          <p class="text-subtitle-1 text-grey-darken-1">
            Benvingut a la Plataforma de Normalització de Plans Individualitzats (PI).
          </p>
        </div>

        <v-row class="mb-6">
          <v-col cols="12" sm="4">
            <v-card class="gencat-card pa-4 d-flex align-center" elevation="0" rounded="lg">
              <v-avatar color="red-lighten-5" rounded="lg" class="mr-4">
                <v-icon icon="mdi-account-group" color="#D0021B"></v-icon>
              </v-avatar>
              <div>
                <div class="text-caption font-weight-bold text-grey">TOTAL ALUMNES</div>
                <div class="text-h5 font-weight-bold text-grey-darken-3">Gestió Global</div>
              </div>
            </v-card>
          </v-col>
          
          <v-col cols="12" sm="4">
            <v-card class="gencat-card pa-4 d-flex align-center" elevation="0" rounded="lg">
              <v-avatar color="grey-lighten-4" rounded="lg" class="mr-4">
                <v-icon icon="mdi-file-document-alert" color="grey-darken-3"></v-icon>
              </v-avatar>
              <div>
                <div class="text-caption font-weight-bold text-grey">ESTAT DOCUMENTAL</div>
                <div class="text-h5 font-weight-bold text-grey-darken-3">Revisió PI</div>
              </div>
            </v-card>
          </v-col>

          <v-col cols="12" sm="4">
            <v-card class="gencat-card pa-4 d-flex align-center" elevation="0" rounded="lg">
              <v-avatar color="grey-lighten-4" rounded="lg" class="mr-4">
                <v-icon icon="mdi-school" color="grey-darken-3"></v-icon>
              </v-avatar>
              <div>
                <div class="text-caption font-weight-bold text-grey">CENTRES</div>
                <div class="text-h5 font-weight-bold text-grey-darken-3">Xarxa Educativa</div>
              </div>
            </v-card>
          </v-col>
        </v-row>

        <h2 class="text-h6 font-weight-bold text-grey-darken-3 mb-4 d-flex align-center">
          <v-icon icon="mdi-apps" class="mr-2" size="small" color="#D0021B"></v-icon>
          Operacions Principals
        </h2>

        <v-row>
          <v-col cols="12" md="6">
            <v-card
              class="gencat-card action-card h-100 pa-6 cursor-pointer"
              elevation="0"
              rounded="lg"
              @click="$router.push('/alumnos')"
            >
              <div class="d-flex justify-space-between align-start">
                <div>
                  <div class="d-flex align-center mb-3">
                    <v-icon icon="mdi-format-list-bulleted" color="#D0021B" size="large" class="mr-3"></v-icon>
                    <h3 class="text-h5 font-weight-bold text-grey-darken-3">Gestió d'Alumnes</h3>
                  </div>
                  <p class="text-body-1 text-grey-darken-1 mb-6" style="line-height: 1.6;">
                    Accediu al llistat complet per consultar expedients, filtrar per RALC o gestionar la documentació dels Plans Individualitzats.
                  </p>
                </div>
                <v-icon icon="mdi-arrow-right" class="arrow-icon text-grey-lighten-1" size="large"></v-icon>
              </div>
              
              <div class="mt-auto">
                <v-btn variant="text" color="#D0021B" class="px-0 font-weight-bold text-none hover-underline">
                  Accedir al llistat
                  <v-icon end icon="mdi-chevron-right"></v-icon>
                </v-btn>
              </div>
            </v-card>
          </v-col>

          <v-col cols="12" md="6">
            <v-card
              class="gencat-card action-card h-100 pa-6 cursor-pointer"
              elevation="0"
              rounded="lg"
              @click="$router.push('/nuevo-alumno')"
            >
              <div class="d-flex justify-space-between align-start">
                <div>
                  <div class="d-flex align-center mb-3">
                    <v-icon icon="mdi-account-plus" color="#D0021B" size="large" class="mr-3"></v-icon>
                    <h3 class="text-h5 font-weight-bold text-grey-darken-3">Alta d'Alumne</h3>
                  </div>
                  <p class="text-body-1 text-grey-darken-1 mb-6" style="line-height: 1.6;">
                    Registreu un nou alumne al sistema, assigneu-li un identificador RALC i vinculeu-lo al centre educatiu corresponent.
                  </p>
                </div>
                <v-icon icon="mdi-arrow-right" class="arrow-icon text-grey-lighten-1" size="large"></v-icon>
              </div>

              <div class="mt-auto">
                <v-btn variant="text" color="#D0021B" class="px-0 font-weight-bold text-none hover-underline">
                  Iniciar registre
                  <v-icon end icon="mdi-chevron-right"></v-icon>
                </v-btn>
              </div>
            </v-card>
          </v-col>
        </v-row>

        <v-row class="mt-6">
            <v-col cols="12">
                <v-card class="gencat-card pa-4 bg-grey-lighten-4" elevation="0" rounded="lg">
                    <v-row align="center" no-gutters>
                        <v-col cols="12" md="8">
                            <div class="d-flex align-center">
                                <v-icon icon="mdi-lifebuoy" color="grey-darken-2" class="mr-3"></v-icon>
                                <div>
                                    <div class="text-subtitle-2 font-weight-bold text-grey-darken-3">Necessiteu ajuda?</div>
                                    <div class="text-caption text-grey-darken-1">Consulteu la guia d'usuari per a la normalització de documents PI.</div>
                                </div>
                            </div>
                        </v-col>
                        <v-col cols="12" md="4" class="text-md-right mt-2 mt-md-0">
                             <v-btn size="small" variant="outlined" color="grey-darken-2">Veure Documentació</v-btn>
                        </v-col>
                    </v-row>
                </v-card>
            </v-col>
        </v-row>

      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
/* TIPOGRAFIA OFICIAL */
.gencat-font {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
}

/* TARGETA BASE */
.gencat-card {
  border: 1px solid rgba(0,0,0,0.08) !important;
  background-color: white;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

/* TARGETES D'ACCIÓ (INTERACTIVITAT) */
.action-card {
  border-left: 4px solid transparent !important; /* Preparem la vora esquerra */
}

.action-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0,0,0,0.08) !important;
  border-left-color: #D0021B !important; /* Vora vermella corporativa al hover */
}

/* Fletxa animada */
.arrow-icon {
    transition: transform 0.3s ease, color 0.3s ease;
}

.action-card:hover .arrow-icon {
    transform: translateX(5px);
    color: #D0021B !important;
}

/* Botó amb subratllat al hover */
.hover-underline:hover {
    text-decoration: underline;
}

.cursor-pointer {
  cursor: pointer;
}
</style>