<template>
  <v-card class="mt-4" elevation="2" border>
    <v-card-title class="bg-blue-grey-lighten-5 text-blue-grey-darken-4 d-flex align-center">
      <v-icon start color="primary" icon="mdi-robot-outline"></v-icon>
      Resum IA del Pla Individualitzat
    </v-card-title>

    <v-card-text class="pt-4">
      <!-- Missatge si no troba res -->
      <v-alert v-if="isEmpty" type="info" variant="tonal" density="compact" class="mb-4">
        No s'han detectat patrons clars en aquest document. Revisa el PDF original per més detalls.
        <div v-if="analysis.stats" class="mt-2 text-caption text-grey-darken-2">
          <strong>Diagnòstic tècnic:</strong> S'han llegit {{ analysis.stats.length }} caràcters.
          <br>
          <strong>Inici del text:</strong> "{{ analysis.stats.preview }}"
        </div>
      </v-alert>

      <v-row v-else>
        <!-- 1. Perfil / Diagnòstic -->
        <v-col cols="12" v-if="analysis.perfil?.length">
          <div class="d-flex align-center mb-2">
            <v-icon color="primary" class="mr-2">mdi-account-alert</v-icon>
            <h3 class="text-subtitle-1 font-weight-bold text-primary">Perfil i Diagnòstic</h3>
            <v-btn variant="text" icon="mdi-volume-high" size="small" color="primary" class="ml-2"
              @click="speak(analysis.perfil.join('. '))" title="Llegir en veu alta">
            </v-btn>
          </div>
          <ul class="ml-8 text-body-2">
            <li v-for="(item, i) in analysis.perfil" :key="i" class="mb-1">
              <span v-html="highlightKeywords(item)"></span>
            </li>
          </ul>
          <v-divider class="my-3"></v-divider>
        </v-col>

        <!-- 2. Dificultats -->
        <v-col cols="12" md="6" v-if="analysis.dificultats?.length">
          <div class="d-flex align-center mb-2">
            <v-icon color="orange-darken-2" class="mr-2">mdi-alert-circle-outline</v-icon>
            <h3 class="text-subtitle-1 font-weight-bold text-orange-darken-2">Dificultats Principals</h3>
            <v-btn variant="text" icon="mdi-volume-high" size="small" color="orange-darken-2" class="ml-2"
              @click="speak(analysis.dificultats.join('. '))">
            </v-btn>
          </div>
          <ul class="ml-8 text-body-2">
            <li v-for="(item, i) in analysis.dificultats" :key="i" class="mb-1">
              <span v-html="highlightKeywords(item)"></span>
            </li>
          </ul>
        </v-col>

        <!-- 3. Adaptacions -->
        <v-col cols="12" md="6" v-if="analysis.adaptacions?.length">
          <div class="d-flex align-center mb-2">
            <v-icon color="green-darken-2" class="mr-2">mdi-hand-heart-outline</v-icon>
            <h3 class="text-subtitle-1 font-weight-bold text-green-darken-2">Adaptacions Metodològiques</h3>
            <v-btn variant="text" icon="mdi-volume-high" size="small" color="green-darken-2" class="ml-2"
              @click="speak(analysis.adaptacions.join('. '))">
            </v-btn>
          </div>
          <ul class="ml-8 text-body-2">
            <li v-for="(item, i) in analysis.adaptacions" :key="i" class="mb-1">
              <span v-html="highlightKeywords(item)"></span>
            </li>
          </ul>
        </v-col>

        <!-- 4. Avaluació -->
        <v-col cols="12" md="6" v-if="analysis.avaluacio?.length">
          <div class="d-flex align-center mb-2">
            <v-icon color="blue-darken-2" class="mr-2">mdi-clipboard-check-outline</v-icon>
            <h3 class="text-subtitle-1 font-weight-bold text-blue-darken-2">Criteris d'Avaluació</h3>
            <v-btn variant="text" icon="mdi-volume-high" size="small" color="blue-darken-2" class="ml-2"
              @click="speak(analysis.avaluacio.join('. '))">
            </v-btn>
          </div>
          <ul class="ml-8 text-body-2">
            <li v-for="(item, i) in analysis.avaluacio" :key="i" class="mb-1">
              <span v-html="highlightKeywords(item)"></span>
            </li>
          </ul>
        </v-col>

        <!-- 5. Recomanacions -->
        <v-col cols="12" md="6" v-if="analysis.recomanacions?.length">
          <div class="d-flex align-center mb-2">
            <v-icon color="purple-darken-2" class="mr-2">mdi-lightbulb-on-outline</v-icon>
            <h3 class="text-subtitle-1 font-weight-bold text-purple-darken-2">Recomanacions Docents</h3>
            <v-btn variant="text" icon="mdi-volume-high" size="small" color="purple-darken-2" class="ml-2"
              @click="speak(analysis.recomanacions.join('. '))">
            </v-btn>
          </div>
          <ul class="ml-8 text-body-2">
            <li v-for="(item, i) in analysis.recomanacions" :key="i" class="mb-1">
              <span v-html="highlightKeywords(item)"></span>
            </li>
          </ul>
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>
</template>

<script setup>
import { computed, ref } from 'vue';

const props = defineProps({
  analysis: {
    type: Object,
    required: true,
    default: () => ({
      perfil: [], dificultats: [], adaptacions: [], avaluacio: [], recomanacions: []
    })
  }
});

const isEmpty = computed(() => {
  return !props.analysis.perfil?.length && !props.analysis.dificultats?.length &&
         !props.analysis.adaptacions?.length && !props.analysis.avaluacio?.length &&
         !props.analysis.recomanacions?.length;
});

// Estat per saber quin text s'està reproduint
const currentText = ref('');

// Llista de paraules clau per destacar (de més específiques a més genèriques)
const keywords = [
  'Retard Greu', 'Retard', 'Manca d’atenció', 'Manca d\'atenció', 'Baix nivell',
  'discapacitat intel·lectual', 'discapacitat visual', 'discapacitat auditiva', 'discapacitat',
  'trastorns neurològics', 'trastorns psicosocials', 'Trastorn d’aprenentatge', 'Trastorn',
  'TDAH', 'TDA', 'Dislèxia', 'Hiperactivitat', 'dèficit d’atenció',
  'dificultat en la lectura', 'dificultat en l\'expressió escrita'
];

const highlightKeywords = (text) => {
  if (!text) return '';
  // Creem una única expressió regular amb totes les paraules clau
  const regex = new RegExp(`(${keywords.join('|')})`, 'gi');
  return text.replace(regex, '<span class="text-blue-darken-2 font-weight-bold">$1</span>');
};

const speak = (text) => {
  if (!text) return;
  
  // Si ja està parlant, parem (Toggle)
  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
    // Si era el mateix text, sortim (només parem)
    if (currentText.value === text) {
      currentText.value = '';
      return;
    }
  }
  
  currentText.value = text;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ca-ES'; // Català
  utterance.rate = 0.9; // Una mica més lent per millorar l'entonació
  utterance.onend = () => { currentText.value = ''; }; // Reset quan acaba
  window.speechSynthesis.speak(utterance);
};
</script>