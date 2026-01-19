<script setup>
import { ref, watch } from 'vue';
import { useTheme } from 'vuetify';
import { useSpeechRecognition } from '@/composables/useSpeechRecognition';

const theme = useTheme();
const { isListening, transcript, interimTranscript, error, start } = useSpeechRecognition();

// Estat del diàleg (finestra flotant)
const showDialog = ref(false);
const feedbackMessage = ref("Escoltant...");
const feedbackColor = ref("primary");

// Funció per iniciar
const handleStart = () => {
  feedbackMessage.value = "Escoltant...";
  feedbackColor.value = "primary";
  transcript.value = ""; // Netejem text anterior
  showDialog.value = true;
  start();
};

// Lògica de reacció a la veu
watch(transcript, (newText) => {
  if (!newText) return;
  const command = newText.toLowerCase().trim();
  
  // Processem la comanda
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
  else if (command.includes('tanca') || command.includes('sortir')) {
     showDialog.value = false;
     return;
  }
  else {
    feedbackMessage.value = "No t'he entès 😕";
    feedbackColor.value = "warning";
  }

  // Tanquem la finestra automàticament després de 2 segons si hi ha hagut èxit
  if (feedbackColor.value === 'success' || feedbackColor.value === 'warning') {
    setTimeout(() => {
      showDialog.value = false;
    }, 2000);
  }
});

// Tanquem el diàleg si el micròfon es para per error o silenci llarg
watch(isListening, (listening) => {
  if (!listening && !transcript.value) {
    setTimeout(() => { showDialog.value = false; }, 1000);
  }
});
</script>

<template>
  <!-- Botó de la barra -->
  <v-btn icon class="mr-2" @click="handleStart">
    <v-icon 
      :color="isListening ? 'red' : 'white'" 
      :class="{'pulse-animation': isListening}"
    >
      mdi-microphone
    </v-icon>
  </v-btn>

  <!-- Finestra flotant petita -->
  <v-dialog v-model="showDialog" width="auto" location="top center" absolute offset="20">
    <v-card min-width="300" class="pa-4 rounded-xl" elevation="8">
      <div class="d-flex flex-column align-center">
        <!-- Icona animada dins el diàleg -->
        <v-avatar :color="feedbackColor" variant="tonal" size="50" class="mb-3">
          <v-icon :icon="isListening ? 'mdi-microphone' : 'mdi-check'" size="28"></v-icon>
        </v-avatar>

        <!-- Text d'estat -->
        <div class="text-subtitle-1 font-weight-bold mb-1">
          {{ feedbackMessage }}
        </div>

        <!-- Transcripció en temps real (el que dius) -->
        <div v-if="isListening" class="text-caption text-grey text-center font-italic">
          "{{ interimTranscript || transcript || '...' }}"
        </div>
      </div>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.pulse-animation {
  animation: pulse-red 1.5s infinite;
}

@keyframes pulse-red {
  0% { transform: scale(1); text-shadow: 0 0 0 rgba(255, 0, 0, 0); }
  50% { transform: scale(1.2); text-shadow: 0 0 10px rgba(255, 0, 0, 0.8); }
  100% { transform: scale(1); text-shadow: 0 0 0 rgba(255, 0, 0, 0); }
}
</style>