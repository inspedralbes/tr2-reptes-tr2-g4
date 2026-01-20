<script setup>
import { ref, watch } from 'vue';
import { useTheme } from 'vuetify';
import { useSpeechRecognition } from '@/composables/useSpeechRecognition';

const theme = useTheme();
const { isListening, transcript, interimTranscript, error, start, stop } = useSpeechRecognition();

const showDialog = ref(false);
const feedbackMessage = ref("T'estic escoltant...");
const feedbackColor = ref("primary");

// Funció per tancar/cancel·lar
const handleCancel = () => {
  stop(); 
  showDialog.value = false; 
};

const handleStart = () => {
  feedbackMessage.value = "T'estic escoltant..."; // Missatge més natural
  feedbackColor.value = "primary";
  transcript.value = "";
  showDialog.value = true;
  start();
};

// --- GESTIÓ D'ERRORS (Friendly User Version) ---
watch(error, (newError) => {
  if (newError) {
    // Per defecte, color taronja (avís) en lloc de vermell (error greu)
    feedbackColor.value = "warning";
    
    // Traducció a llenguatge humà
    if (newError === 'network') {
       // El famós error d'Electron sense claus
       feedbackMessage.value = "Servei no disponible ara mateix";
       feedbackColor.value = "grey"; // Gris perquè l'usuari vegi que està "apagat"
    } 
    else if (newError === 'not-allowed') {
        feedbackMessage.value = "Necessito permís de micròfon";
    } 
    else if (newError === 'no-speech') {
        feedbackMessage.value = "No t'he sentit, torna-hi!";
        // Aquest no és greu, així que el deixem tancar sol ràpid
        setTimeout(() => { if(showDialog.value) handleCancel() }, 2000);
        return; 
    } 
    else if (newError === 'audio-capture') {
        feedbackMessage.value = "No trobo cap micròfon";
    } 
    else {
        feedbackMessage.value = "Hi ha hagut un petit problema";
    }
  }
});

// --- GESTIÓ DE COMANDES ---
watch(transcript, (newText) => {
  if (!newText) return;
  const command = newText.toLowerCase().trim();
  
  // Respostes més naturals
  if (command.includes('saluda') || command.includes('hola')) {
    feedbackMessage.value = "Hola! Benvingut 👋";
    feedbackColor.value = "success";
  } 
  else if (command.includes('mode fosc') || command.includes('nit')) {
    theme.global.name.value = 'dark';
    feedbackMessage.value = "Fet! Mode fosc activat 🌙";
    feedbackColor.value = "success";
  }
  else if (command.includes('mode clar') || command.includes('dia')) {
    theme.global.name.value = 'light';
    feedbackMessage.value = "Fet! Mode clar activat ☀️";
    feedbackColor.value = "success";
  }
  else if (command.includes('esborra')) {
    feedbackMessage.value = "D'acord, esborrat";
    feedbackColor.value = "info";
  }
  else {
    feedbackMessage.value = "No t'he acabat d'entendre 😕";
    feedbackColor.value = "warning";
  }

  // Si és un èxit (verd), tanquem ràpid
  if (feedbackColor.value === 'success') {
      setTimeout(() => { showDialog.value = false; }, 1500);
  }
});
</script>

<template>
  <!-- Botó Barra (Icona neta) -->
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

  <!-- Finestra Flotant (Pop-up Amable) -->
  <v-dialog v-model="showDialog" width="auto" scrim="true" persistent>
    <v-card min-width="380" class="pa-6 rounded-xl d-flex flex-column align-center bg-grey-darken-4 text-white border-highlight position-relative" elevation="24">
      
      <!-- Botó X discret -->
      <v-btn 
        icon="mdi-close" 
        variant="text" 
        color="grey" 
        size="small"
        class="position-absolute top-0 right-0 ma-2"
        @click="handleCancel"
      ></v-btn>

      <!-- Icona Gran -->
      <v-avatar :color="feedbackColor" size="64" class="mb-4" variant="tonal">
        <v-icon 
            :icon="feedbackColor === 'success' ? 'mdi-check' : (isListening ? 'mdi-waveform' : 'mdi-microphone-off')" 
            size="32"
        ></v-icon>
      </v-avatar>
      
      <!-- Missatge Principal (Amable) -->
      <div class="text-h6 font-weight-bold mb-2 text-center">
        {{ feedbackMessage }}
      </div>
      
      <!-- Text que l'usuari està dient (només si no hi ha error) -->
      <div class="transcript-box text-center mb-4">
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

.transcript-box { min-height: 40px; display: flex; align-items: center; justify-content: center; width: 100%; }
.border-highlight { border: 1px solid rgba(255, 255, 255, 0.1); }
.pulse-animation { animation: pulse-red 1.5s infinite; }
@keyframes pulse-red {
  0% { transform: scale(1); text-shadow: 0 0 0 rgba(255, 82, 82, 0); }
  50% { transform: scale(1.2); text-shadow: 0 0 15px rgba(255, 82, 82, 0.8); }
  100% { transform: scale(1); text-shadow: 0 0 0 rgba(255, 82, 82, 0); }
}
</style>