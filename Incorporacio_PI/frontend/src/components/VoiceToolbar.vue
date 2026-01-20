<script setup>
import { ref, watch } from 'vue';
import { useTheme } from 'vuetify';
import { useSpeechRecognition } from '@/composables/useSpeechRecognition';

const theme = useTheme();
const { isListening, transcript, interimTranscript, error, start, stop } = useSpeechRecognition();

const showDialog = ref(false);
const feedbackMessage = ref("Escoltant...");
const feedbackColor = ref("primary"); // primary, success, warning, error
const showCloseBtn = ref(false); // Per mostrar botó si hi ha error

const handleStart = () => {
  // Reiniciem estats
  feedbackMessage.value = "Escoltant...";
  feedbackColor.value = "primary";
  showCloseBtn.value = false;
  transcript.value = "";
  
  showDialog.value = true;
  start();
};

const handleStop = () => {
    stop();
    showDialog.value = false;
};

// 1. Monitoritzem els ERRORS del composable
watch(error, (newError) => {
  if (newError) {
    console.error("Error detectat:", newError);
    feedbackColor.value = "error"; // Vermell
    showCloseBtn.value = true; // Deixem que l'usuari tanqui manualment
    
    // Traduïm els errors més comuns
    if (newError === 'not-allowed') {
        feedbackMessage.value = "Accés denegat al micròfon 🚫";
    } else if (newError === 'no-speech') {
        feedbackMessage.value = "No s'ha detectat veu 🔇";
    } else if (newError === 'audio-capture') {
        feedbackMessage.value = "No es troba el micròfon 🔌";
    } else {
        feedbackMessage.value = `Error: ${newError}`;
    }
  }
});

// 2. Monitoritzem el TEXT (Èxit)
watch(transcript, (newText) => {
  if (!newText) return;
  
  const command = newText.toLowerCase().trim();
  
  if (command.includes('saluda') || command.includes('hola')) {
    feedbackMessage.value = "Hola! 👋";
    feedbackColor.value = "success";
  } 
  else if (command.includes('mode fosc') || command.includes('nit')) {
    theme.global.name.value = 'dark';
    feedbackMessage.value = "Mode fosc activat 🌙";
    feedbackColor.value = "success";
  }
  else if (command.includes('mode clar') || command.includes('dia')) {
    theme.global.name.value = 'light';
    feedbackMessage.value = "Mode clar activat ☀️";
    feedbackColor.value = "success";
  }
  else if (command.includes('esborra')) {
    feedbackMessage.value = "Text esborrat";
    feedbackColor.value = "info";
  }
  else {
    feedbackMessage.value = "No entès 😕";
    feedbackColor.value = "warning";
  }

  // Tanquem automàticament si ha anat bé
  setTimeout(() => { showDialog.value = false; }, 1500);
});

// 3. Monitoritzem si deixa d'escoltar (però només tanquem si no hi ha error)
watch(isListening, (listening) => {
  if (!listening) {
     // Si s'ha parat, no hi ha text i NO hi ha error, llavors és silenci
     if (!transcript.value && !error.value) {
         feedbackMessage.value = "No t'he sentit...";
         feedbackColor.value = "grey";
         setTimeout(() => { showDialog.value = false; }, 1500);
     }
  }
});
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

  <!-- Popup -->
  <v-dialog v-model="showDialog" width="auto" scrim="true" persistent>
    <v-card min-width="400" class="pa-6 rounded-xl d-flex flex-column align-center bg-grey-darken-4 text-white border-highlight" elevation="24">
      
      <!-- Icona -->
      <v-avatar :color="feedbackColor" size="60" class="mb-4" variant="tonal">
        <v-icon 
            :icon="feedbackColor === 'error' ? 'mdi-alert-circle' : (isListening ? 'mdi-waveform' : 'mdi-microphone-off')" 
            size="36"
        ></v-icon>
      </v-avatar>
      
      <!-- Missatge Principal -->
      <div class="text-h6 font-weight-bold mb-2 text-center">{{ feedbackMessage }}</div>
      
      <!-- Text que vas dient (Interim) -->
      <div class="transcript-box text-center mb-4" v-if="!error">
        <h3 class="text-h5 font-weight-regular text-grey-lighten-1 transition-swing">
            {{ interimTranscript || transcript || '...' }}
        </h3>
      </div>

      <!-- Botó Tancar (Surt si hi ha error o vols cancel·lar) -->
      <v-btn 
        v-if="showCloseBtn || isListening"
        variant="outlined" 
        :color="feedbackColor === 'error' ? 'red' : 'white'" 
        class="mt-2"
        @click="handleStop"
      >
        Tancar
      </v-btn>

    </v-card>
  </v-dialog>
</template>

<style scoped>
.voice-btn { border: none !important; }
.transcript-box { min-height: 40px; display: flex; align-items: center; justify-content: center; width: 100%; }
.border-highlight { border: 1px solid rgba(255, 255, 255, 0.1); }
.pulse-animation { animation: pulse-red 1.5s infinite; }
@keyframes pulse-red {
  0% { transform: scale(1); text-shadow: 0 0 0 rgba(255, 82, 82, 0); }
  50% { transform: scale(1.2); text-shadow: 0 0 15px rgba(255, 82, 82, 0.8); }
  100% { transform: scale(1); text-shadow: 0 0 0 rgba(255, 82, 82, 0); }
}
</style>