require('dotenv').config();
const OpenAI = require("openai");

// Configuració del client OpenRouter
const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": "http://localhost:3000", // Canviar pel domini real si cal
    "X-Title": "Projecte Incorporacio PI",
  }
});

// LLISTA DE MODELS GRATUÏTS D'OPENROUTER (Ordre de preferència)
const MODELS = [
  "mistralai/mistral-7b-instruct:free",           // Molt fiable i ràpid
  "google/gemini-2.0-flash-lite-preview-02-05:free", // Molt potent (Google)
  "meta-llama/llama-3.1-8b-instruct:free",        // L'estàndard actual de Meta
  "qwen/qwen-2.5-7b-instruct-1m:free"             // Molt bo per a textos llargs
];

/**
 * Genera un resum utilitzant OpenRouter i l'envia per streaming a la resposta Express.
 * @param {string} text - Text a resumir
 * @param {object} res - Objecte Response d'Express per fer streaming
 * @param {number} modelIndex - Índex del model inicial per provar (per a rotació)
 */
async function generateSummaryStream(text, res, modelIndex = 0) {

  // Retallem el text per no saturar el context del model
  const MAX_CHARS = 100000; 
  const truncatedText = text.length > MAX_CHARS ? text.substring(0, MAX_CHARS) + "..." : text;

  const messages = [
    {
      role: "system",
      content: `Ets un analista documental expert. La teva missió és facilitar el traspàs d'informació d'alumnes que passen de Secundària a Formació Professional (FP).
      
      OBJECTIU PRINCIPAL: El nou centre ha de rebre informació clara sobre:
      1. Les adaptacions educatives aplicades.
      2. Quines han funcionat i en quin context.
      3. Quines es podrien aplicar o adaptar al nou centre (FP).

      ESTRUCTURA OBLIGATÒRIA: Has de generar CINC seccions. Cada secció ha de començar AMB EL TÍTOL EXACTE en una línia separada, sense text addicional en aquella línia. Els títols són:
      1. PERFIL DE L'ALUMNE
      2. DIFICULTATS I BARRERES
      3. ADAPTACIONS METODOLÒGIQUES
      4. AVALUACIÓ I QUALIFICACIÓ
      5. RECOMANACIONS I TRASPÀS

      REGLA D'OR DEL FORMAT "DETALL":
      Per a cada punt, has de seguir aquest format: "Idea principal resumida. [[Detall: **[Font: Secció]** Copia aquí el text original complet del PDF per si el docent necessita més context o informació extra.]]".
      NO resumeixis en excés, extreu les frases clau literals.

      INSTRUCCIONS ESPECÍFIQUES:
      - **Perfil**: Resum breu (2-3 línies) amb dades acadèmiques, diagnòstic i motiu.
      - **Adaptacions per Matèries**: 
        - FORMAT: Fes una llista on cada punt comenci amb l'assignatura o àmbit seguit de dos punts.
        - Exemple: "- Matemàtiques: Ús de calculadora..."
        - NO facis taules Markdown. Utilitza llistes per aprofitar millor l'espai en columnes.
      - **Recomanacions**: Redacta un text fluid però MOLT ESPECÍFIC. NO facis servir frases genèriques com "continuar amb les adaptacions". Has d'explicar QUINES són (ex: "Donar més temps", "Ús de calculadora", "Pautes escrites").
      - **Exhaustivitat**: Processa totes les pàgines.
      - **Taules Originals**: Si detectes taules amb 'X' al PDF, indica clarament què està marcat dins del detall.
      - **Noms**: Ignora noms de professionals.

      Exemple de sortida desitjada:
      - Matemàtiques: Ús de calculadora. [[Detall: **[Font: Adaptacions]** L'alumne millora amb calculadora...]]

      Processa tot el text proporcionat.`
    },
    {
      role: "user",
      content: `Analitza aquest PI i extreu-ne la informació rellevant:\n\n${truncatedText}`
    }
  ];

  // --- MODE NÚVOL (OPENROUTER) ---
  if (!process.env.OPENROUTER_API_KEY) {
    console.error("❌ Manca la OPENROUTER_API_KEY al fitxer .env");
    res.write("[SYS_ERROR:Manca la clau API d'OpenRouter al servidor. Revisa el fitxer .env]");
    res.end();
    return;
  }

  console.log("☁️  Iniciant cicle de models a OpenRouter...");
  
  // Intentem els models en ordre, començant pel sol·licitat (rotació)
  let attempts = 0;
  while (attempts < MODELS.length) {
    const currentIdx = (modelIndex + attempts) % MODELS.length;
    const model = MODELS[currentIdx];
    attempts++;

    try {
      console.log(`🤖 [aiService] Provant generació amb model [${currentIdx}] ${model}...`);
      
      const stream = await openai.chat.completions.create({
        model: model,
        messages: messages,
        stream: true,
        temperature: 0.2, // Baixa temperatura per ser més precís
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          res.write(content);
        }
      }
      
      console.log(`✅ [aiService] ÈXIT amb el model: ${model}`);
      res.end();
      return; 

    } catch (error) {
      console.warn(`⚠️ [aiService] Error amb el model ${model}: ${error.message}`);
      
      // Si és un error de límit de quota o servidor, esperem una mica
      if (error.status === 429 || error.status >= 500) {
         await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  // Si arribem aquí, tots els models han fallat
  console.warn("☁️❌ [aiService] Tots els models OpenRouter han fallat.");
  res.write("[SYS_ERROR:No s'ha pogut generar el resum amb cap dels models disponibles al núvol.]");
  res.end();
}

module.exports = { generateSummaryStream };