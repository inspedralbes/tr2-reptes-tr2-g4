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
            <v-icon color="primary" class="mr-2">mdi-account-circle-outline</v-icon>
            <h3 class="text-subtitle-1 font-weight-bold text-primary">Perfil de l'alumne</h3>
            <v-btn variant="text" icon="mdi-volume-high" size="small" color="primary" class="ml-2"
              @click="speak(analysis.perfil.join('. '))" title="Llegir en veu alta">
            </v-btn>
          </div>
          <div class="ml-4 text-body-2">
            <template v-for="(item, i) in cleanList(analysis.perfil)" :key="i">
              <!-- RENDERITZAT DE TAULA (Si la línia comença per |) -->
              <div v-if="item.trim().startsWith('|')" class="d-flex align-center py-1 border-b w-100 my-2">
                <v-row no-gutters>
                  <v-col cols="4" class="font-weight-bold text-primary pr-2">
                    {{ getTableCol(item, 0) }}
                  </v-col>
                  <v-col cols="8">
                    {{ getTableCol(item, 1) }}
                    <span v-if="getDetailText(item)" class="text-primary font-weight-bold cursor-pointer ml-1 text-caption" style="text-decoration: underline;">
                      (+ Info)
                      <v-menu activator="parent" location="end" open-on-hover :close-on-content-click="false" max-width="600" offset="10">
                        <v-card class="pa-4 bg-grey-lighten-5" elevation="4" border style="max-height: 400px; overflow-y: auto;">
                          <div class="text-caption font-weight-bold mb-1 text-grey-darken-3">Detall complet del document:</div>
                          <span class="text-body-2 font-italic" style="white-space: pre-line;" v-html="highlightKeywords(getDetailText(item))"></span>
                        </v-card>
                      </v-menu>
                    </span>
                  </v-col>
                </v-row>
              </div>

              <!-- RENDERITZAT NORMAL (Text seguit) -->
              <div v-else class="mb-2">
                <span>
                <span v-html="highlightKeywords(getMainText(item))"></span>
                <span v-if="!/[.:!?]$/.test(getMainText(item))">.</span>
                <span v-if="getDetailText(item)" class="text-primary font-weight-bold cursor-pointer ml-1 text-caption" style="text-decoration: underline;">
                  (+ Info)
                  <v-menu activator="parent" location="end" open-on-hover :close-on-content-click="false" max-width="600" offset="10">
                    <v-card class="pa-4 bg-grey-lighten-5" elevation="4" border style="max-height: 400px; overflow-y: auto;">
                      <div class="text-caption font-weight-bold mb-1 text-grey-darken-3">Detall complet del document:</div>
                      <span class="text-body-2 font-italic" style="white-space: pre-line;" v-html="highlightKeywords(getDetailText(item))"></span>
                    </v-card>
                  </v-menu>
                </span>
                </span>
              </div>
            </template>
          </div>
          <v-divider class="my-3"></v-divider>
        </v-col>

        <!-- 2. Dificultats -->
        <v-col cols="12" v-if="analysis.dificultats?.length">
          <div class="d-flex align-center mb-2">
            <v-icon color="orange-darken-2" class="mr-2">mdi-alert-circle-outline</v-icon>
            <h3 class="text-subtitle-1 font-weight-bold text-orange-darken-2">Diagnòstic</h3>
            <v-btn variant="text" icon="mdi-volume-high" size="small" color="orange-darken-2" class="ml-2"
              @click="speak(analysis.dificultats.join('. '))">
            </v-btn>
          </div>
          <div class="ml-4 text-body-2">
            <template v-for="(item, i) in cleanList(analysis.dificultats)" :key="i">
              <div class="mb-2">
                <span>
                <span v-html="highlightKeywords(getMainText(item))"></span>
                <span v-if="!/[.:!?]$/.test(getMainText(item))">.</span>
                <span v-if="getDetailText(item)" class="text-primary font-weight-bold cursor-pointer ml-1 text-caption" style="text-decoration: underline;">
                  (+ Info)
                  <v-menu activator="parent" location="end" open-on-hover :close-on-content-click="false" max-width="600" offset="10">
                    <v-card class="pa-4 bg-grey-lighten-5" elevation="4" border style="max-height: 400px; overflow-y: auto;">
                      <div class="text-caption font-weight-bold mb-1 text-grey-darken-3">Detall complet del document:</div>
                      <span class="text-body-2 font-italic" style="white-space: pre-line;" v-html="highlightKeywords(getDetailText(item))"></span>
                    </v-card>
                  </v-menu>
                </span>
                </span>
              </div>
            </template>
          </div>
        </v-col>

        <!-- 3. Justificació del PI (Només Orientador) -->
        <v-col cols="12" v-if="analysis.justificacio?.length">
          <div class="d-flex align-center mb-2">
            <v-icon color="deep-orange-darken-2" class="mr-2">mdi-text-box-search-outline</v-icon>
            <h3 class="text-subtitle-1 font-weight-bold text-deep-orange-darken-2">Justificació del PI</h3>
            <v-btn variant="text" icon="mdi-volume-high" size="small" color="deep-orange-darken-2" class="ml-2"
              @click="speak(analysis.justificacio.join('. '))">
            </v-btn>
          </div>
          <div class="ml-4 text-body-2">
            <template v-for="(item, i) in cleanList(analysis.justificacio)" :key="i">
              <div class="mb-2">
                <span>
                <span v-html="highlightKeywords(getMainText(item))"></span>
                <span v-if="!/[.:!?]$/.test(getMainText(item))">.</span>
                <!-- Detall popup code... -->
                <span v-if="getDetailText(item)" class="text-primary font-weight-bold cursor-pointer ml-1 text-caption" style="text-decoration: underline;">
                  (+ Info)
                  <v-menu activator="parent" location="end" open-on-hover :close-on-content-click="false" max-width="600" offset="10">
                    <v-card class="pa-4 bg-grey-lighten-5" elevation="4" border style="max-height: 400px; overflow-y: auto;">
                      <div class="text-caption font-weight-bold mb-1 text-grey-darken-3">Detall complet del document:</div>
                      <span class="text-body-2 font-italic" style="white-space: pre-line;" v-html="highlightKeywords(getDetailText(item))"></span>
                    </v-card>
                  </v-menu>
                </span>
                </span>
              </div>
            </template>
          </div>
        </v-col>

        <!-- 4. Orientació a l'Aula -->
        <v-col cols="12" v-if="analysis.recomanacions?.length">
          <div class="d-flex align-center mb-2">
            <v-icon color="purple-darken-2" class="mr-2">mdi-lightbulb-on-outline</v-icon>
            <h3 class="text-subtitle-1 font-weight-bold text-purple-darken-2">Orientació a l'Aula</h3>
            <v-btn variant="text" icon="mdi-volume-high" size="small" color="purple-darken-2" class="ml-2"
              @click="speak(analysis.recomanacions.join('. '))">
            </v-btn>
          </div>
          <div class="ml-4 text-body-2">
            <template v-for="(item, i) in cleanList(analysis.recomanacions)" :key="i">
              <div class="mb-2 d-flex align-start">
                <v-icon icon="mdi-circle-small" size="small" color="grey" class="mt-1 mr-2"></v-icon>
                <span>
                <span v-html="highlightKeywords(getMainText(item))"></span>
                <span v-if="!/[.:!?]$/.test(getMainText(item))">.</span>
                <span v-if="getDetailText(item)" class="text-primary font-weight-bold cursor-pointer ml-1 text-caption" style="text-decoration: underline;">
                  (+ Info)
                  <v-menu activator="parent" location="end" open-on-hover :close-on-content-click="false" max-width="600" offset="10">
                    <v-card class="pa-4 bg-grey-lighten-5" elevation="4" border style="max-height: 400px; overflow-y: auto;">
                      <div class="text-caption font-weight-bold mb-1 text-grey-darken-3">Detall complet del document:</div>
                      <span class="text-body-2 font-italic" style="white-space: pre-line;" v-html="highlightKeywords(getDetailText(item))"></span>
                    </v-card>
                  </v-menu>
                </span>
                </span>
              </div>
            </template>
          </div>
        </v-col>

        <!-- 5. Assignatures / Matèries -->
        <v-col cols="12" v-if="analysis.adaptacions?.length">
          <div class="d-flex align-center mb-2">
            <v-icon color="green-darken-2" class="mr-2">mdi-hand-heart-outline</v-icon>
            <h3 class="text-subtitle-1 font-weight-bold text-green-darken-2">{{ role === 'orientador' ? 'Matèries' : 'Assignatures' }}</h3>
            <v-btn variant="text" icon="mdi-volume-high" size="small" color="green-darken-2" class="ml-2"
              @click="speak(analysis.adaptacions.join('. '))">
            </v-btn>
          </div>
          <div class="ml-4 text-body-2 list-columns">
            <div v-for="(item, i) in cleanList(analysis.adaptacions)" :key="i" class="mb-2 list-item-break">
              <!-- RENDERITZAT DE TAULA (Si la línia comença per |) -->
              <div v-if="item.trim().startsWith('|')" class="mb-2">
                <strong class="text-primary">{{ getTableCol(item, 0) }}:</strong>
                <span class="ml-2">
                    {{ getTableCol(item, 1) }}
                    <!-- Suport per detalls dins la taula -->
                    <span v-if="getDetailText(item)" class="text-primary font-weight-bold cursor-pointer ml-1 text-caption" style="text-decoration: underline;">
                      (+ Info)
                      <v-menu activator="parent" location="end" open-on-hover :close-on-content-click="false" max-width="600" offset="10">
                        <v-card class="pa-4 bg-grey-lighten-5" elevation="4" border style="max-height: 400px; overflow-y: auto;">
                          <div class="text-caption font-weight-bold mb-1 text-grey-darken-3">Detall complet del document:</div>
                          <span class="text-body-2 font-italic" style="white-space: pre-line;" v-html="highlightKeywords(getDetailText(item))"></span>
                        </v-card>
                      </v-menu>
                    </span>
                </span>
              </div>

              <!-- RENDERITZAT CLAU-VALOR (Estil Taula Visual) -->
              <div v-else-if="isKV(item)" class="mb-2 border-b pb-1">
                <v-row no-gutters>
                  <v-col cols="12" sm="9" class="text-primary font-weight-bold">
                    {{ getKV(item).k }}:
                  </v-col>
                  <v-col cols="12" sm="3" class="pl-4">
                    <span v-html="highlightKeywords(getKV(item).v)"></span>
                    <span v-if="getDetailText(item)" class="text-primary font-weight-bold cursor-pointer ml-1 text-caption" style="text-decoration: underline;">
                      (+ Info)
                      <v-menu activator="parent" location="end" open-on-hover :close-on-content-click="false" max-width="600" offset="10">
                        <v-card class="pa-4 bg-grey-lighten-5" elevation="4" border style="max-height: 400px; overflow-y: auto;">
                          <div class="text-caption font-weight-bold mb-1 text-grey-darken-3">Detall complet del document:</div>
                          <span class="text-body-2 font-italic" style="white-space: pre-line;" v-html="highlightKeywords(getDetailText(item))"></span>
                        </v-card>
                      </v-menu>
                    </span>
                  </v-col>
                </v-row>
              </div>

              <!-- RENDERITZAT NORMAL (Llista) -->
              <div v-else>
                <span v-html="highlightKeywords(getMainText(item))"></span>
                <span v-if="getDetailText(item)" class="text-primary font-weight-bold cursor-pointer ml-2 text-caption" style="text-decoration: underline;">
                  (+ Info)
                  <v-menu activator="parent" location="end" open-on-hover :close-on-content-click="false" max-width="600" offset="10">
                    <v-card class="pa-4 bg-grey-lighten-5" elevation="4" border style="max-height: 400px; overflow-y: auto;">
                      <div class="text-caption font-weight-bold mb-1 text-grey-darken-3">Detall complet del document:</div>
                      <span class="text-body-2 font-italic" style="white-space: pre-line;" v-html="highlightKeywords(getDetailText(item))"></span>
                    </v-card>
                  </v-menu>
                </span>
              </div>
            </div>
          </div>
        </v-col>

        <!-- 6. Criteris d'Avaluació -->
        <v-col cols="12" v-if="analysis.avaluacio?.length">
          <div class="d-flex align-center mb-2">
            <v-icon color="blue-darken-2" class="mr-2">mdi-clipboard-check-outline</v-icon>
            <h3 class="text-subtitle-1 font-weight-bold text-blue-darken-2">Criteris d'Avaluació</h3>
            <v-btn variant="text" icon="mdi-volume-high" size="small" color="blue-darken-2" class="ml-2"
              @click="speak(analysis.avaluacio.join('. '))">
            </v-btn>
          </div>
          <div class="ml-4 text-body-2">
            <template v-for="(item, i) in cleanList(analysis.avaluacio)" :key="i">
              <!-- RENDERITZAT CLAU-VALOR (Estil Taula Visual) -->
              <div v-if="isKV(item)" class="mb-2 border-b pb-1">
                <v-row no-gutters>
                  <v-col cols="12" sm="4" class="text-primary font-weight-bold pr-2">
                    {{ getKV(item).k }}:
                  </v-col>
                  <v-col cols="12" sm="8">
                    <span v-html="highlightKeywords(getKV(item).v)"></span>
                  </v-col>
                </v-row>
              </div>
              
              <div v-else class="mb-2 d-flex align-start">
                <v-icon icon="mdi-circle-small" size="small" color="grey" class="mt-1 mr-2"></v-icon>
                <span>
                <span v-html="highlightKeywords(getMainText(item))"></span>
                <span v-if="!/[.:!?]$/.test(getMainText(item))">.</span>
                <span v-if="getDetailText(item)" class="text-primary font-weight-bold cursor-pointer ml-1 text-caption" style="text-decoration: underline;">
                  (+ Info)
                  <v-menu activator="parent" location="end" open-on-hover :close-on-content-click="false" max-width="600" offset="10">
                    <v-card class="pa-4 bg-grey-lighten-5" elevation="4" border style="max-height: 400px; overflow-y: auto;">
                      <div class="text-caption font-weight-bold mb-1 text-grey-darken-3">Detall complet del document:</div>
                      <span class="text-body-2 font-italic" style="white-space: pre-line;" v-html="highlightKeywords(getDetailText(item))"></span>
                    </v-card>
                  </v-menu>
                </span>
                </span>
              </div>
            </template>
          </div>
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
      perfil: [], dificultats: [], justificacio: [], adaptacions: [], avaluacio: [], recomanacions: []
    })
  },
  role: {
    type: String,
    default: 'docent'
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

const cleanList = (list) => {
  if (!list) return [];
  return list
    .map(item => {
      // 1. Neteja caràcters de llista a l'inici (com +, -, *, •, etc.)
      // MODIFICAT: Ara elimina també els espais abans del símbol (ex: " * Text")
      let clean = item.replace(/^\s*[\/\*+\-•]+\s*/, '').trim();
      // 2. Si ha quedat un ** al final sense parella, el traiem
      if (clean.endsWith('**') && clean.indexOf('**') === clean.length - 2) {
        clean = clean.substring(0, clean.length - 2);
      }
      // 3. Si la línia és només "xxx" o símbols, la ignorem
      if (clean.match(/^[x\s,\.\-]+$/i)) return null;
      
      // 4. FILTRE DE SEGURETAT: Eliminem línies amb dades administratives si la IA s'ha equivocat
      const lower = clean.toLowerCase();
      if (lower.startsWith('nom i cognoms') || 
          lower.startsWith('director') || 
          lower.startsWith('coordinador') || 
          lower.includes('membres que han participat') ||
          lower === 'curriculars' ||
          lower.includes('dades dels professionals')) {
        return null;
      }
      // 5. Eliminem la línia separadora de taules Markdown (|---|)
      if (clean.match(/^\|[\s-]+\|[\s-]+\|$/)) {
        return null;
      }
      
      // 6. FILTRE DE REDUNDÀNCIA: Eliminem frases introductòries que repeteixen el títol
      if (clean.match(/^(les habilitats|les adaptacions|que es proposen|habilitats acadèmiques afectades|altres dificultats).{0,20}:?$/i)) {
        return null;
      }
      if (clean.match(/^(són|es proposen|consisteixen en):?$/i)) {
        return null;
      }
      // 7. FILTRE DE BROSSA: Eliminem frases de formulari buides
      if (clean.match(/^(altres adaptacions|especifiqueu-les|adaptacions específiques).{0,30}$/i)) {
        return null;
      }

      return clean;
    })
    .filter(item => item && item.length > 2); // Filtrem línies buides o molt curtes
};

const highlightKeywords = (text) => {
  if (!text) return '';
  let processed = text;

  // 1. Convertir Markdown bold (**text**) a HTML bold
  processed = processed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // 2. Ressaltar la font d'informació [Font: ...]
  processed = processed.replace(/\[Font:(.*?)\]/g, '<span class="text-caption text-grey-darken-1 font-italic">[Font:$1]</span>');

  // 3. Ressaltar encapçalaments tipus "Matèria:" (per fer efecte taula)
  // Millora: Accepta "Matèria:-" i afegeix espai, netejant el format
  processed = processed.replace(/^([^:]+):[\s-]*/, '<strong class="text-primary">$1:</strong> ');

  // 4. Ressaltar paraules clau
  const regex = new RegExp(`(${keywords.join('|')})`, 'gi');
  processed = processed.replace(regex, '<span class="text-blue-darken-2 font-weight-bold">$1</span>');
  
  return processed;
};

const getMainText = (item) => {
  // Retorna el text principal eliminant la part de [[Detall...]]
  // Modificat per acceptar tancament amb ]] o ] (per si la IA s'equivoca)
  return item.replace(/\[\[.*?\]+$/s, '').trim();
};

const getDetailText = (item) => {
  // Extreu el text dins de [[ ... ]]
  // Modificat per acceptar tancament amb ]] o ]
  const match = item.match(/\[\[(.*?)\]+$/s);
  if (!match) return null;
  let text = match[1].trim();
  // Remove "Detall:" prefix if present (case insensitive)
  text = text.replace(/^Detall:\s*/i, '');
  return text;
};

const getTableCol = (item, colIndex) => {
  // Neteja la línia de taula "| Col1 | Col2 |" i retorna la columna
  const parts = item.split('|').filter(p => p.trim().length > 0);
  return parts[colIndex] ? getMainText(parts[colIndex].trim()) : '';
};

// Detecta si és una línia tipus "Clau: Valor" per formatar-la com a taula
const isKV = (text) => {
  if (!text) return false;
  const idx = text.indexOf(':');
  // Ha de tenir ':' al principi (no al final de la frase) i no ser una taula '|'
  return idx > 2 && idx < 60 && !text.trim().startsWith('|');
};

// Detecta si és un encapçalament de secció (text curt sense dos punts, tot majúscules o inici de bloc)
const getKV = (text) => {
  const idx = text.indexOf(':');
  return { k: text.substring(0, idx).trim(), v: text.substring(idx + 1).trim() };
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

<style scoped>
.list-columns {
  column-count: 1;
}
@media (min-width: 960px) {
  .list-columns {
    column-count: 2;
    column-gap: 32px;
  }
}
.list-item-break {
  -webkit-column-break-inside: avoid;
  page-break-inside: avoid;
  break-inside: avoid;
}
</style>