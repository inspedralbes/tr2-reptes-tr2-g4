const { InferenceClient } = require("@huggingface/inference");

// Llegim el token del .env (que ja carrega el server.js)
const HF_TOKEN = process.env.VITE_HF_ACCESS_TOKEN;

// LLISTA DE MODELS PER ORDRE DE PREFERÈNCIA (Estratègia de Rotació)
// Si el primer falla (per límits), provarà el segon, etc.
const MODELS = [
  // --- TIER 1: Ràpids, Moderns i Eficients (Prioritat Alta) ---
  "microsoft/Phi-3.5-mini-instruct",
  "mistralai/Mistral-Nemo-Instruct-2407",
  "Qwen/Qwen2.5-7B-Instruct",
  "google/gemma-2-9b-it",
  "meta-llama/Meta-Llama-3.1-8B-Instruct",
  "meta-llama/Llama-3.2-3B-Instruct",
  "HuggingFaceH4/zephyr-7b-beta",
  
  // --- TIER 2: Família Qwen (Molt fiables a Hugging Face) ---
  "Qwen/Qwen2.5-14B-Instruct",
  "Qwen/Qwen2.5-32B-Instruct",
  "Qwen/Qwen2.5-72B-Instruct",
  "Qwen/Qwen2-7B-Instruct",
  "Qwen/Qwen2-72B-Instruct",
  "Qwen/Qwen2-57B-A14B-Instruct",
  "Qwen/Qwen1.5-72B-Chat",
  "Qwen/Qwen1.5-32B-Chat",
  "Qwen/Qwen1.5-14B-Chat",
  "Qwen/Qwen1.5-7B-Chat",
  "Qwen/Qwen1.5-4B-Chat",
  "Qwen/Qwen2.5-3B-Instruct",
  "Qwen/Qwen2.5-1.5B-Instruct",

  // --- TIER 3: Família Mistral & Mixtral ---
  "mistralai/Mixtral-8x7B-Instruct-v0.1",
  "mistralai/Mixtral-8x22B-Instruct-v0.1",
  "mistralai/Mistral-7B-Instruct-v0.3",
  "mistralai/Mistral-7B-Instruct-v0.2",
  "mistralai/Mistral-7B-Instruct-v0.1",
  "Open-Orca/Mistral-7B-OpenOrca",
  "teknium/OpenHermes-2.5-Mistral-7B",
  "NousResearch/Nous-Hermes-2-Mixtral-8x7B-DPO",
  "cognitivecomputations/dolphin-2.8-mistral-7b-v02",

  // --- TIER 4: Família Llama (Meta) ---
  "meta-llama/Meta-Llama-3-8B-Instruct",
  "meta-llama/Meta-Llama-3-70B-Instruct",
  "meta-llama/Llama-3.2-1B-Instruct",
  "meta-llama/Llama-2-7b-chat-hf",
  "meta-llama/Llama-2-13b-chat-hf",
  "meta-llama/Llama-2-70b-chat-hf",
  "NousResearch/Hermes-3-Llama-3.1-8B",
  "cognitivecomputations/dolphin-2.9.4-llama3.1-8b",
  
  // --- TIER 5: Família Gemma (Google) ---
  "google/gemma-2-27b-it",
  "google/gemma-2-2b-it",
  "google/gemma-1.1-7b-it",
  "google/gemma-1.1-2b-it",
  "google/gemma-7b-it",
  "google/gemma-2b-it",
  "HuggingFaceH4/zephyr-7b-gemma-v0.1",

  // --- TIER 6: Família Phi (Microsoft) ---
  "microsoft/Phi-3-mini-128k-instruct",
  "microsoft/Phi-3-medium-128k-instruct",
  "microsoft/Phi-3-small-8k-instruct",
  "microsoft/Phi-3-small-128k-instruct",
  "microsoft/phi-2",

  // --- TIER 7: Família Yi (01.AI) ---
  "01-ai/Yi-1.5-34B-Chat",
  "01-ai/Yi-1.5-9B-Chat",
  "01-ai/Yi-1.5-6B-Chat",
  "01-ai/Yi-34B-Chat",
  "01-ai/Yi-6B-Chat",

  // --- TIER 8: DeepSeek & CodeLlama (Bons en lògica) ---
  "deepseek-ai/deepseek-coder-33b-instruct",
  "deepseek-ai/deepseek-coder-6.7b-instruct",
  "deepseek-ai/deepseek-llm-67b-chat",
  "deepseek-ai/deepseek-llm-7b-chat",
  "codellama/CodeLlama-70b-Instruct-hf",
  "codellama/CodeLlama-34b-Instruct-hf",
  "codellama/CodeLlama-13b-Instruct-hf",
  "codellama/CodeLlama-7b-Instruct-hf",

  // --- TIER 9: Altres Models d'Alta Qualitat ---
  "CohereForAI/c4ai-command-r-plus",
  "CohereForAI/c4ai-command-r-v01",
  "databricks/dbrx-instruct",
  "nvidia/Llama-3.1-Nemotron-70B-Instruct-HF",
  "upstage/SOLAR-10.7B-Instruct-v1.0",
  "openchat/openchat-3.5-0106",
  "berkeley-nest/Starling-LM-7B-alpha",
  "stabilityai/stablelm-zephyr-3b",
  "allenai/tulu-2-dpo-70b",
  "Intel/neural-chat-7b-v3-1",
  "tiiuae/falcon-40b-instruct"
];

/**
 * Genera un resum utilitzant Hugging Face i l'envia per streaming a la resposta Express.
 * @param {string} text - Text a resumir
 * @param {object} res - Objecte Response d'Express per fer streaming
 */
async function generateSummaryStream(text, res) {
  if (!HF_TOKEN) {
    console.error("Manca el token VITE_HF_ACCESS_TOKEN");
    res.write("Error: Token de Hugging Face no configurat al servidor.");
    res.end();
    return;
  }

  const client = new InferenceClient(HF_TOKEN);

  // Retallem el text per no saturar el context del model (aprox 15k paraules)
  const MAX_CHARS = 60000; // Reduït per seguretat a la capa gratuïta
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
        - CRÍTIC: Si les adaptacions són per a "Totes les matèries" (o general), NO FACIS TAULA. Fes una llista normal amb guions (-). Si dubtes, prioritza llista general.
        - Només fes TAULA MARKDOWN (| Assignatura | Adaptació |) si hi ha assignatures diferents (ex: Mates, Català, etc.). Assegura't de fer servir el caràcter '|' per separar columnes.
      - **Recomanacions**: Redacta un text fluid però MOLT ESPECÍFIC. NO facis servir frases genèriques com "continuar amb les adaptacions". Has d'explicar QUINES són (ex: "Donar més temps", "Ús de calculadora", "Pautes escrites").
      - **Exhaustivitat**: Processa totes les pàgines.
      - **Taules Originals**: Si detectes taules amb 'X' al PDF, indica clarament què està marcat dins del detall.
      - **Noms**: Ignora noms de professionals.

      Exemple de sortida desitjada:
      | Matemàtiques | Ús de calculadora. [[Detall: **[Font: Adaptacions]** L'alumne millora amb calculadora...]] |

      Processa tot el text proporcionat.`
    },
    {
      role: "user",
      content: `Analitza aquest PI i extreu-ne la informació rellevant:\n\n${truncatedText}`
    }
  ];

  // BUCLE DE RESILIÈNCIA: Prova models en ordre fins que un funcioni
  for (const model of MODELS) {
    let success = false;
    try {
      console.log(`🤖 Provant generació amb model: ${model}...`);
      
      // Reduïm max_tokens per evitar timeouts a la capa gratuïta
      const stream = client.chatCompletionStream({
        model: model,
        messages: messages,
        max_tokens: 2048, // Més conservador que 8000
        temperature: 0.3,
        top_p: 0.9
      });

      for await (const chunk of stream) {
        if (chunk.choices && chunk.choices.length > 0) {
          const content = chunk.choices[0].delta.content || "";
          res.write(content);
        }
      }
      
      success = true;
      console.log(`✅ Èxit amb el model: ${model}`);
      // Si arribem aquí, ha funcionat! Sortim del bucle i de la funció.
      res.end();
      return; 

    } catch (error) {
      console.warn(`⚠️ Error amb el model ${model}: ${error.message}`);
      
      // Si és un error de límit de quota, esperem 1 segon abans de provar el següent
      if (error.message.includes("rate limit") || error.message.includes("usage limit")) {
         await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  // Si arribem aquí, tots han fallat
  console.error("❌ Tots els models han fallat.");
  res.write("\n\n[Error: El sistema d'IA està saturat o ha superat la quota gratuïta. Si us plau, intenta-ho més tard o revisa el token de Hugging Face.]");
  res.end();
}

module.exports = { generateSummaryStream };