<script setup>
import { ref, watch } from 'vue';
import { useTheme } from 'vuetify';
import { useRouter } from 'vue-router'; // 1. Importem el router
import { useSpeechRecognition } from '@/composables/useSpeechRecognition';

const theme = useTheme();
const router = useRouter(); // 2. Inicialitzem el router
const { isListening, transcript, interimTranscript, error, start, stop } = useSpeechRecognition();

const showDialog = ref(false);
const feedbackMessage = ref("T'estic escoltant...");
const feedbackColor = ref("primary");
const showHelp = ref(false); // 3. Nou estat per mostrar la llista d'ajuda

// Llista de comandes per mostrar a l'ajuda
const availableCommands = [
  { text: "Logs / Historial", icon: "mdi-history", desc: "Veure els logs" },
  { text: "Alta / Registre", icon: "mdi-account-plus", desc: "Nou alumne" },
  { text: "Gestió / Llistat", icon: "mdi-format-list-bulleted", desc: "Llista alumnes" },
  { text: "Mode Fosc / Clar", icon: "mdi-theme-light-dark", desc: "Canviar tema" },
  { text: "Saluda", icon: "mdi-hand-wave", desc: "Prova de veu" }
];

const handleCancel = () => {
  stop(); 
  showDialog.value = false; 
};

const handleStart = () => {
  feedbackMessage.value = "T'estic escoltant...";
  feedbackColor.value = "primary";
  transcript.value = "";
  showHelp.value = false; // Amaguem l'ajuda al començar de nou
  showDialog.value = true;
  start();
};

// --- GESTIÓ D'ERRORS ---
watch(error, (newError) => {
  if (newError) {
    feedbackColor.value = "warning";
    if (newError === 'network') {
       feedbackMessage.value = "Servei no disponible ara mateix";
       feedbackColor.value = "grey";
    } else if (newError === 'not-allowed') {
        feedbackMessage.value = "Necessito permís de micròfon";
    } else if (newError === 'no-speech') {
        feedbackMessage.value = "No t'he sentit, torna-hi!";
        setTimeout(() => { if(showDialog.value && !showHelp.value) handleCancel() }, 2000);
        return; 
    } else {
        feedbackMessage.value = "Hi ha hagut un petit problema";
    }
  }
});

// --- GESTIÓ DE COMANDES (Rutes i Lògica) ---
watch(transcript, (newText) => {
  if (!newText) return;
  const command = newText.toLowerCase().trim();
  
  // 1. NAVEGACIÓ ALS LOGS
  if (command.includes('logs') || command.includes('historial')) {
    feedbackMessage.value = "Accedint a l'Historial...";
    feedbackColor.value = "success";
    setTimeout(() => { 
        router.push('/logs'); // Assegura't que la ruta '/logs' existeix al router/index.js
        showDialog.value = false;
    }, 1000);
  }

  // 2. ALTA D'ALUMNE
  else if (command.includes('alta') || command.includes('registre') || command.includes('nou alumne')) {
    feedbackMessage.value = "Obrint formulari d'Alta...";
    feedbackColor.value = "success";
    setTimeout(() => { 
        router.push('/nuevo-alumno'); 
        showDialog.value = false;
    }, 1000);
  }

  // 3. GESTIÓ / LLISTAT D'ALUMNES
  else if (command.includes('gestió') || command.includes('llistat') || command.includes('alumnes')) {
    feedbackMessage.value = "Anant al llistat d'alumnes...";
    feedbackColor.value = "success";
    setTimeout(() => { 
        router.push('/alumnos'); 
        showDialog.value = false;
    }, 1000);
  }

  // 4. MENÚ D'AJUDA (Aquí no tanquem el diàleg automàticament)
  else if (command.includes('ajuda') || command.includes('help') || command.includes('comandes')) {
    feedbackMessage.value = "Aquí tens el que pots dir:";
    feedbackColor.value = "info";
    showHelp.value = true; // Mostrem la llista visual
  }

  // 5. ALTRES COMANDES (Tema, Saluda, etc.)
  else if (command.includes('mode fosc') || command.includes('nit')) {
    theme.global.name.value = 'dark';
    feedbackMessage.value = "Mode fosc activat 🌙";
    feedbackColor.value = "success";
    closeSuccess();
  }
  else if (command.includes('mode clar') || command.includes('dia')) {
    theme.global.name.value = 'light';
    feedbackMessage.value = "Mode clar activat ☀️";
    feedbackColor.value = "success";
    closeSuccess();
  }
  else if (command.includes('saluda') || command.includes('hola')) {
    feedbackMessage.value = "Hola! Benvingut 👋";
    feedbackColor.value = "success";
    closeSuccess();
  }
  else if (command.includes('esborra')) {
    feedbackMessage.value = "D'acord, esborrat";
    feedbackColor.value = "info";
  }
  else {
    feedbackMessage.value = "No t'he acabat d'entendre 😕";
    feedbackColor.value = "warning";
  }
});

// Helper per tancar automàticament si no estem en mode ajuda
const closeSuccess = () => {
    setTimeout(() => { 
        if (!showHelp.value) showDialog.value = false; 
    }, 1500);
}
</script>

<template>
  <!-- Botó Barra -->
  <v-btn 
    icon 
    variant="text"
    :ripple="false"
    @click="handleStart" 
    class="voice-btn"
    style="background-color: transparent !important; box-shadow: none !important;"
  >
    <v-icon 
      size="28"
      :color="isListening ? 'red-accent-2' : 'white'" 
      :class="{'pulse-animation': isListening}"
    >
      mdi-microphone
    </v-icon>
    <v-tooltip activator="parent" location="bottom">Control per Veu</v-tooltip>
  </v-btn>

  <!-- Finestra Flotant -->
  <v-dialog v-model="showDialog" width="auto" scrim="true" persistent>
    <v-card min-width="400" max-width="500" class="pa-6 rounded-xl d-flex flex-column align-center bg-grey-darken-4 text-white border-highlight position-relative" elevation="24">
      
      <!-- Botó X -->
      <v-btn 
        icon="mdi-close" 
        variant="text" 
        color="grey" 
        size="small"
        class="position-absolute top-0 right-0 ma-2"
        @click="handleCancel"
      ></v-btn>

      <!-- Encapçalament (Icona + Missatge) -->
      <div class="d-flex flex-column align-center mb-2">
          <v-avatar :color="feedbackColor" size="64" class="mb-4" variant="tonal">
            <v-icon 
                :icon="feedbackColor === 'success' ? 'mdi-check' : (showHelp ? 'mdi-information-variant' : (isListening ? 'mdi-waveform' : 'mdi-microphone-off'))" 
                size="32"
            ></v-icon>
          </v-avatar>
          <div class="text-h6 font-weight-bold text-center">{{ feedbackMessage }}</div>
      </div>
      
      <!-- CONTINGUT CENTRAL: O bé el text que parles O bé l'ajuda -->
      
      <!-- CAS 1: LLISTA D'AJUDA -->
      <div v-if="showHelp" class="w-100 mt-2 mb-4">
        <v-list bg-color="transparent" density="compact">
            <v-list-item v-for="(cmd, i) in availableCommands" :key="i" class="rounded-lg mb-1 bg-grey-darken-3">
                <template v-slot:prepend>
                    <v-icon :icon="cmd.icon" color="primary" class="mr-2"></v-icon>
                </template>
                <v-list-item-title class="text-body-2 font-weight-bold">{{ cmd.text }}</v-list-item-title>
                <v-list-item-subtitle class="text-caption text-grey-lighten-1">{{ cmd.desc }}</v-list-item-subtitle>
            </v-list-item>
        </v-list>
      </div>

      <!-- CAS 2: TRANSCRIPCIÓ DE VEU NORMAL -->
      <div v-else class="transcript-box text-center mb-4">
        <h3 v-if="!error" class="text-h5 font-weight-regular text-grey-lighten-1 transition-swing">
            {{ interimTranscript || transcript || '...' }}
        </h3>
      </div>

      <!-- Botó d'Acció -->
      <v-btn 
        variant="flat" 
        :color="feedbackColor === 'success' ? 'green' : 'red-darken-1'" 
        class="mt-2 px-8"
        rounded="pill"
        @click="handleCancel"
      >
        {{ isListening ? 'Aturar' : 'Tancar' }}
      </v-btn>

    </v-card>
  </v-dialog>
</template>

<style scoped>
.voice-btn { border: none !important; }
.position-relative { position: relative !important; }
.position-absolute { position: absolute !important; }
.top-0 { top: 0; }
.right-0 { right: 0; }
.w-100 { width: 100%; }

.transcript-box { min-height: 40px; display: flex; align-items: center; justify-content: center; width: 100%; }
.border-highlight { border: 1px solid rgba(255, 255, 255, 0.1); }
.pulse-animation { animation: pulse-red 1.5s infinite; }
@keyframes pulse-red {
  0% { transform: scale(1); text-shadow: 0 0 0 rgba(255, 82, 82, 0); }
  50% { transform: scale(1.2); text-shadow: 0 0 15px rgba(255, 82, 82, 0.8); }
  100% { transform: scale(1); text-shadow: 0 0 0 rgba(255, 82, 82, 0); }
}
</style>