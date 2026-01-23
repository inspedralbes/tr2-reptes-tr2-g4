<template>
  <v-container fluid class="fill-height pa-0" style="height: calc(100vh - 64px);">
    <v-row no-gutters class="fill-height">
      <!-- COLUMNA ESQUERRA: VISOR DOCUMENT -->
      <v-col cols="12" md="6" class="d-flex flex-column border-r">
        <div class="bg-grey-lighten-4 pa-4 d-flex align-center justify-space-between border-b">
          <div class="d-flex align-center">
            <v-btn icon="mdi-arrow-left" variant="text" @click="$router.back()" class="mr-2"></v-btn>
            <h2 class="text-subtitle-1 text-truncate">{{ filename }}</h2>
          </div>
          <v-chip size="small" color="primary">Visor de Text</v-chip>
        </div>
        
        <div class="flex-grow-1 bg-grey-lighten-2" style="height: 100%; overflow: hidden;">
          <div v-if="loading" class="d-flex justify-center mt-10">
            <v-progress-circular indeterminate color="primary"></v-progress-circular>
          </div>
          <div v-else-if="error" class="text-error pa-4">
            {{ error }}
          </div>
          <!-- VISOR PDF NATIU (Només per a PDF) -->
          <iframe 
            v-else-if="isPdf"
            :src="pdfUrl" 
            width="100%" 
            height="100%" 
            style="border: none;"
          ></iframe>
          <!-- VISOR DE TEXT (Per a DOCX/ODT) -->
          <div v-else class="pa-4 bg-white h-100 overflow-y-auto text-body-2 font-mono" style="white-space: pre-wrap;">
            <div v-if="!documentText" class="text-center text-grey mt-10">
               <v-icon size="48">mdi-text-box-search-outline</v-icon>
               <p>Llegint el contingut del document...</p>
            </div>
            <div v-else>{{ documentText }}</div>
          </div>
        </div>
      </v-col>

      <!-- COLUMNA DRETA: XAT -->
      <v-col cols="12" md="6" class="d-flex flex-column bg-grey-lighten-5">
        <div class="bg-white pa-4 border-b elevation-1 d-flex align-center">
          <v-icon color="deep-purple" class="mr-2">mdi-magnify-scan</v-icon>
          <h2 class="text-h6">Cercador Intel·ligent</h2>
        </div>

        <!-- ZONA MISSATGES -->
        <div class="flex-grow-1 pa-4 overflow-y-auto" ref="chatContainer" style="height: 100%;">
          <div v-if="messages.length === 0" class="text-center text-grey mt-10">
            <v-icon size="64" color="grey-lighten-2">mdi-text-search</v-icon>
            <p class="mt-2">Escriu què vols trobar (ex: "curs", "diagnòstic", "pautes").</p>
          </div>

          <div v-for="(msg, i) in messages" :key="i" class="d-flex mb-4" :class="msg.role === 'user' ? 'justify-end' : 'justify-start'">
            <v-card :color="msg.role === 'user' ? 'deep-purple-lighten-4' : 'white'" :variant="msg.role === 'user' ? 'flat' : 'elevated'" max-width="80%" class="rounded-lg pa-3">
              <div class="text-body-2">{{ msg.content }}</div>
            </v-card>
          </div>
        </div>

        <!-- INPUT -->
        <div class="pa-4 bg-white border-t">
          <v-form @submit.prevent="sendMessage">
            <v-text-field
              v-model="newMessage"
              placeholder="Què vols buscar al document?"
              variant="outlined"
              density="comfortable"
              hide-details
              append-inner-icon="mdi-send"
              @click:append-inner="sendMessage"
              :loading="thinking"
              :disabled="thinking"
            ></v-text-field>
          </v-form>
        </div>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { ref, onMounted, nextTick, computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const filename = route.params.filename;

const documentText = ref('');
const loading = ref(true);
const error = ref(null);
const messages = ref([
  { role: 'assistant', content: 'Hola! Soc el teu assistent de cerca. Sobre què vols preguntar del document?' }
]);
const newMessage = ref('');
const thinking = ref(false);
const chatContainer = ref(null);
const searchTerm = ref('');

const isPdf = computed(() => filename.toLowerCase().endsWith('.pdf'));

const pdfUrl = computed(() => {
  const url = `http://localhost:4002/uploads/${filename}`;
  return searchTerm.value ? `${url}#search="${encodeURIComponent(searchTerm.value)}"` : url;
});

const scrollToBottom = async () => {
  await nextTick();
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
  }
};

const loadDocument = async () => {
  try {
    const response = await fetch(`http://localhost:4002/api/analyze/${encodeURIComponent(filename)}`);
    if (!response.ok) throw new Error('Error carregant document');
    const data = await response.json();
    documentText.value = data.text_completo;
  } catch (e) {
    error.value = "No s'ha pogut carregar el text del document.";
  } finally {
    loading.value = false;
  }
};

const sendMessage = async () => {
  if (!newMessage.value.trim() || thinking.value) return;
  
  const question = newMessage.value;
  
  messages.value.push({ role: 'user', content: question });
  
  newMessage.value = '';
  thinking.value = true;
  scrollToBottom();

  try {
    const response = await fetch('http://localhost:4002/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: documentText.value, question: question })
    });
    if (!response.ok) throw new Error('Error al xat');
    const data = await response.json();

    // NOU: Tractem la resposta com a resultat directe
    const answer = data.answer.trim().replace(/^["']|["']$/g, ''); 
    
    if (answer && !answer.includes("NO_TROBAT")) {
        searchTerm.value = answer; 
        messages.value.push({ role: 'assistant', content: answer });
    } else {
        messages.value.push({ role: 'assistant', content: "Capaç que no està en aquest document." });
    }
  } catch (e) {
    messages.value.push({ role: 'assistant', content: "Error connectant amb la IA." });
  } finally {
    thinking.value = false;
    scrollToBottom();
  }
};

onMounted(() => loadDocument());
</script>