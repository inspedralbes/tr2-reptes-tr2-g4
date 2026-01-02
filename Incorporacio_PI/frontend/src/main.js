/**
 * main.js
 */

// 1. Imports Generales
import { createApp } from 'vue'
import App from './App.vue'

// 2. Importamos el Router que acabamos de configurar
// import router from './router' // <--- COMENTAT: Ja s'inclou dins de registerPlugins

// 3. Plugins (Vuetify, etc.)
import { registerPlugins } from '@/plugins'

// 4. Estilos
import 'unfonts.css'

// --- LÓGICA DE INICIALIZACIÓN ---

// A. Creamos la instancia de la aplicación
const app = createApp(App)

// B. Registramos los plugins base (Vuetify, etc.)
registerPlugins(app)

// C. Registramos el Router (¡IMPORTANTE!)
// app.use(router) // <--- COMENTAT: Això causava el warning de "Plugin already applied"

// D. Finalmente, montamos la aplicación en el HTML
app.mount('#app')