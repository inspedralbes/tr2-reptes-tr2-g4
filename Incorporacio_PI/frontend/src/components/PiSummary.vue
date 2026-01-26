<template>
  <v-card class="mt-4" elevation="2" border>
    <v-card-title class="bg-blue-grey-lighten-5 text-blue-grey-darken-4 d-flex align-center">
      <v-icon start color="primary" icon="mdi-robot-outline"></v-icon>
      Resum IA del Pla Individualitzat
    </v-card-title>

    <v-card-text class="pt-4">
      <v-alert v-if="isEmpty" type="info" variant="tonal" density="compact" class="mb-4">
        No s'han detectat patrons clars en aquest document.
      </v-alert>

      <v-row v-else>
        <v-col cols="12">
            <div v-for="(category, catName) in analysis" :key="catName">
                <div v-for="(section, idx) in category" :key="idx" class="mb-6">
                    <div class="d-flex align-center mb-2 border-bottom-subtle pb-1">
                        <v-icon :icon="getIconForSection(section.title)" color="primary" class="mr-3"></v-icon>
                        <h3 class="text-subtitle-1 font-weight-bold text-grey-darken-3">{{ section.title }}</h3>
                    </div>
                    
                    <div class="text-body-2 text-grey-darken-3 pl-1" style="white-space: pre-line; line-height: 1.6;">
                        {{ cleanContent(section.content) }}
                    </div>
                </div>
            </div>

        </v-col>
      </v-row>
    </v-card-text>
  </v-card>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  analysis: {
    type: Object,
    default: () => ({})
  },
  role: String
});

const isEmpty = computed(() => {
  return !props.analysis || Object.keys(props.analysis).every(k => props.analysis[k].length === 0);
});

const getIconForSection = (title) => {
    const t = (title || '').toUpperCase();
    if (t.includes('EVOLUCI')) return 'mdi-history';
    if (t.includes('ANALISI') || t.includes('COMPARATIVA')) return 'mdi-chart-line';
    if (t.includes('ESTAT') || t.includes('ACTUAL')) return 'mdi-flag-checkered';
    if (t.includes('PERFIL') || t.includes('DADES')) return 'mdi-account-circle';
    if (t.includes('ADAPTACIONS')) return 'mdi-puzzle-outline';
    return 'mdi-information-outline';
};

const cleanContent = (text) => {
    if (!text) return '';
    return text.replace(/\*/g, '•'); 
};
</script>
