const OpenAI = require("openai");

// Configuració del client per a IA LOCAL
const openai = new OpenAI({
  baseURL: "http://pi_llm:8080/v1",
  apiKey: "sk-no-key-required",
  timeout: 60 * 60 * 1000, // 60 minuts EXTREMS per evitar talls en resums globals
});

/**
 * Comprova si el contenidor de la IA està disponible.
 * Ho intenta 5 vegades abans de rendir-se.
 */
async function checkConnection(retries = 100) {
  const url = "http://pi_llm:8080/health"; // Endpoint de salut de llama.cpp
  console.log(`🔍 [aiService] Comprovant connexió amb IA Local (${url})...`);

  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        console.log("✅ [aiService] IA Local ONLINE (Port 8080 obert).");

        /* 
        // Desactivat temporalment per evitar bloquejos en l'arrencada
        console.log("🧪 [aiService] Fent prova de generació ràpida (Warm-up)...");
        try {
          await openai.chat.completions.create({
            model: "default-model",
            messages: [{ role: "user", content: "Test" }],
            max_tokens: 1
          });
          console.log("🚀 [aiService] TEST SUPERAT! La IA està generant text correctament.");
        } catch (e) {
          console.warn("⚠️ [aiService] El test de generació ha fallat (potser està carregant model):", e.message);
        }
        */

        return true;
      }
      // Si respon però no és OK (ex: 503 Loading...), avisem
      console.warn(`⚠️ [aiService] La IA està carregant models (Status: ${response.status})...`);
    } catch (error) {
      console.warn(`⚠️ [aiService] Intent ${i + 1}/${retries} fallit: ${error.message}`);
    }
    // MOGUT: Esperem 3s SEMPRE si no hem acabat, tant si falla la xarxa com si està carregant
    if (i < retries - 1) await new Promise(r => setTimeout(r, 3000));
  }
  console.error("❌ [aiService] IMPOSSIBLE CONNECTAR AMB LA IA. Revisa que el contenidor 'pi_llm' estigui encès i a la mateixa xarxa.");
  return false;
}

/**
 * Genera un resum utilitzant IA LOCAL (sense streaming HTTP directe).
 * Retorna el text complet quan acaba.
 * @param {string} role - 'docent' o 'orientador'
 * @param {function} onProgress - Callback opcional (textParcial, percentatge)
 */
async function generateSummaryLocal(text, role, onProgress) {

  // FASE 0: ESPERAR A QUE LA IA ESTE LLESTA (Status 200)
  // Si el servidor retorna 503, significa que encara està carregant el model. Esperem.
  const healthUrl = "http://pi_llm:8080/health";
  let ready = false;
  let attempts = 0;
  while (!ready && attempts < 20) { // Esperem fins a 1 minut extra (20 * 3s)
    try {
      const hRes = await fetch(healthUrl);
      if (hRes.ok) {
        ready = true;
      } else {
        console.log(`⏳ [aiService] La IA encara està carregant (Status ${hRes.status}). Esperant 3s...`);
        await new Promise(r => setTimeout(r, 3000));
      }
    } catch (e) {
      console.log(`⏳ [aiService] Esperant que el contenidor IA respongui...`);
      await new Promise(r => setTimeout(r, 3000));
    }
    attempts++;
  }

  // Càlcul dinàmic segons la potència configurada al backend/.env
  // Per defecte 4096 tokens si no està definit
  const contextSize = parseInt(process.env.AI_CONTEXT_SIZE) || 4096;

  // Regla de 3 aproximada: 1 token ~= 3-4 chars. Reservem 25% per la resposta.
  // 4096 -> ~12k chars
  // 8192 -> ~25k chars
  const safeChars = Math.floor(contextSize * 2.8);

  const limit = role === 'global' ? safeChars : Math.floor(safeChars * 0.8);
  const MAX_CHARS = limit;
  const truncatedText = text.length > MAX_CHARS ? text.substring(0, MAX_CHARS) + "..." : text;

  let currentProgress = 0;

  // --- SELECCIÓ DE PROMPT SEGONS ROL ---
  let systemPrompt = "";
  let structureExample = "";

  if (role === 'global') {
    systemPrompt = "Ets un expert en educació especial. Genera un resum cronològic de l'historial de l'alumne en FORMAT TEXT (Markdown).";
    structureExample = `
ESTRUCTURA (Fes servir aquests títols exactes):
## EVOLUCIÓ
(Text cronològic...)

## PUNTS CLAU RECURRENTS
(Llista de punts...)

## ADAPTACIONS CONSTANTS
(Llista...)

## ESTAT ACTUAL
(Resum final...)`;

  } else if (role === 'orientador') {
    systemPrompt = `Ets un expert orientador psicopedagògic.
    TASCA: Redactar un informe tècnic basat en el document proporcionat.
    FORMAT: Markdown pur (NO JSON, NO CODI).`;

    structureExample = `
    USA AQUESTA ESTRUCTURA:
    # PERFIL
    ...
    # DIAGNÒSTIC
    ...
    # JUSTIFICACIÓ
    ...
    # ORIENTACIÓ A L'AULA
    ...
    # ASSIGNATURES
    ...
    # CRITERIS D'AVALUACIÓ
    ...`;

  } else {
    // DOCENT (Default)
    systemPrompt = `Ets un psicopedagog expert.
    TASCA: Explicar el contingut del PI a un mestre de forma clara i directa.
    FORMAT: Text normal estructurat amb títols (NO USIS JSON NI CLAU-VALOR).`;

    structureExample = `
    USA AQUESTA ESTRUCTURA:
    # PERFIL
    (Explica qui és l'alumne, curs i situació en un paràgraf text normal)
    
    # ORIENTACIÓ A L'AULA
    - Pauta 1
    - Pauta 2
    
    # ASSIGNATURES
    (Llista les matèries i què cal adaptar en cadascuna)
    
    # CRITERIS D'AVALUACIÓ
    (Com s'ha d'avaluar)`;
  }

  const messages = [
    {
      role: "system",
      content: `${systemPrompt}

        IMPORTANT:
        - NO JSON. NO XML.
        - Escriu tot seguit (paràgrafs i llistes).
        - Utilitza ## TÍTOL GRAN per separar.
        - NO inventis dades personals.
        `
    },
    {
      role: "user",
      content: `DOCUMENT:\n"${truncatedText}"\n\nTASCA: Escriu un resum informatiu per al mestre sobre aquest alumne.
      
      Utilitza exactament aquests apartats:
      ## PERFIL DE L'ALUMNE
      ## PUNTS FORTS I FEBLES
      ## ORIENTACIONS A L'AULA
      ## ADAPTACIONS CURRICULARS
      ## CRITERIS D'AVALUACIÓ`
    }
  ];

  // DEBUG: Veure exactament què estem enviant
  console.log("📨 [aiService] PROMPT ENVIAT:", JSON.stringify(messages, null, 2));

  // DEBUG: Veure exactament què estem enviant
  console.log("📨 [aiService] PROMPT ENVIAT:", JSON.stringify(messages, null, 2));

  try {
    console.log(`🤖 [aiService] Enviant petició a IA Local (http://pi_llm:8080/v1)...`);

    // --- NOU: POLLING DE PROGRÉS REAL (LECTURA) ---
    // Iniciem el polling abans de fer la crida que bloqueja
    // --- NOU: POLLING DE PROGRÉS REAL (LECTURA) ---
    // Iniciem el polling abans de fer la crida que bloqueja
    let readingProgress = 0;
    let lastKnownProgress = 0;
    let lastUpdateTs = Date.now();

    const pollReading = setInterval(async () => {
      try {
        console.log("🔍 [aiService] Polling /slots..."); // Reduïm soroll a request de l'usuari
        const res = await fetch("http://pi_llm:8080/slots");
        if (res.ok) {
          const slots = await res.json();
          // console.log("🔍 [LLM RAW SLOTS]:", JSON.stringify(slots));

          // Busquem el slot que realment està treballant
          const activeSlot = slots.find(s => s.is_processing === true);

          if (activeSlot) {
            // DETECTAR SI JA ESTEM GENERANT (Writing)
            // Si tenim tokens descodificats, ja no estem llegint (Prompt Processing)
            let isGenerating = false;
            if (activeSlot.next_token && activeSlot.next_token.length > 0) {
              if (activeSlot.next_token[0].n_decoded > 0) isGenerating = true;
            }

            if (isGenerating) {
              // Si ja genera, assumim lectura 100% i PAREM el polling per no matxacar l'estat
              // console.log("🧠 [LLM] Detecció de GENERACIÓ iniciada. Aturant polling de lectura.");
              if (onProgress) onProgress(null, 100, true);
              clearInterval(pollReading);
              return;
            }

            let raw = 0;
            // Opció A: El camp directe (versions modern de llama.cpp)
            if (typeof activeSlot.prompt_processing_progress === 'number') {
              raw = activeSlot.prompt_processing_progress;
            }
            // Opció B: Càlcul manual (versions antigues o sense el camp)
            else if (activeSlot.n_prompt > 0) {
              // n_past creix mentre llegeix
              raw = activeSlot.n_past / activeSlot.n_prompt;
            }

            // console.log(`🧠 Slot Actiu trobat: ID=${activeSlot.id}, Progress=${(raw * 100).toFixed(2)}% (Raw: ${raw}, n_past: ${activeSlot.n_past}, n_prompt: ${activeSlot.n_prompt})`);
            // Evitem enviar 0% constantment si no tenim dades
            if (raw > 0) {
              // console.log(`🧠 Slot Actiu trobat: Progress=${(raw * 100).toFixed(2)}%`);
              calculatedSlotProgress = Math.floor(raw * 100);
            }
          } else {
            console.log("🔍 Cap slot processant actualment.");
          }

          if (calculatedSlotProgress > lastKnownProgress) {
            lastKnownProgress = calculatedSlotProgress;
            // console.log(`🧠 [LLM] Slot processing: ${lastKnownProgress}% (Real)`);
            if (onProgress) onProgress(null, lastKnownProgress, true);
          }
        } else {
          console.warn(`⚠️ [aiService] /slots returned ${res.status}`);
        }
      } catch (e) {
        console.error("❌ [aiService] Polling error:", e.cause || e.message);
      }
    }, 500); // Polling cada 0.5s per màxima fluïdesa

    // RETRY LOGIC (3 intents)
    let tries = 0;
    const maxTries = 3;
    let completion = null;

    while (tries < maxTries) {
      try {
        console.log(`🤖 Attempt ${tries + 1}/${maxTries} invoking LLM...`);
        completion = await openai.chat.completions.create({
          model: "default-model",
          messages: messages,
          temperature: 0.7, // Més creativitat per evitar repeticions
          max_tokens: 3000,
          stream: true,
          top_p: 0.95,
          presence_penalty: 0.1, // Lleugera penalització per no repetir
          frequency_penalty: 0.1
        });
        break; // Èxit, sortim del bucle
      } catch (openaiErr) {
        tries++;
        console.error(`❌ [aiService] Error en intent ${tries}:`, openaiErr.message);
        if (tries >= maxTries) throw openaiErr; // Si fallen tots, petem

        // Esperem 2 segons abans de reintentar
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Parem el polling de lectura
    clearInterval(pollReading);

    console.log("🤖 [aiService] Connexió establerta amb LLM! Esperant el primer token (Fase de Lectura/Pre-fill)...");

    let fullText = "";
    // Seccions esperades per calcular el progrés (aprox 20% per secció)
    const sections = ["PERFIL", "DADES", "DIAGNÒSTIC", "ORIENTACIÓ", "ADAPTACIONS", "MATÈRIES", "ASSIGNATURES", "CRITERIS", "JUSTIFICACIÓ"];
    let isFirst = true;
    let chunkCount = 0;

    for await (const chunk of completion) {
      if (isFirst) {
        console.log("🤖 [aiService] Primer token rebut! Comença la generació de text.");
        isFirst = false;
        currentProgress = 0;
      }

      chunkCount++;
      const content = chunk.choices[0]?.delta?.content || "";

      if (chunkCount % 10 === 0) {
        console.log(`... generant (${chunkCount} tokens)`);
      }

      fullText += content;

      if (onProgress) {
        let foundCount = 0;
        sections.forEach(s => {
          if (fullText.includes(s)) foundCount++;
        });

        const chunkProgress = (chunkCount / 20);
        const sectionProgress = foundCount * 5;

        let writeProgress = chunkProgress + sectionProgress;

        // Fase d'escriptura (isReading = false)
        await onProgress(fullText, Math.min(Math.floor(writeProgress), 99), false);
      }
    }

    console.log(`🤖 [IA Local] Generació finalitzada amb èxit. Longitud: ${fullText.length} caràcters.`);
    return fullText;
  } catch (error) {
    console.error("❌ Error IA Local:", error);
    throw new Error("Error connectant amb el contenidor d'IA Local.");
  }
}

/**
 * Converteix el text Markdown generat per la IA en un objecte JSON estructurat.
 * Aquesta lògica és idèntica a la que hi havia al Frontend (SummaryPage.vue).
 * @param {string} text - El text complet generat per la IA
 */
function parseSummaryToJSON(text) {
  const result = {
    perfil: [],
    dificultats: [],
    justificacio: [],
    adaptacions: [],
    avaluacio: [],
    recomanacions: []
  };

  if (!text) return result;

  // Normalitzem salts de línia
  const lines = text.split('\n');
  let currentKey = 'perfil'; // Per defecte tot va a perfil si no hi ha res més

  // Maps de títols a claus
  const sectionMap = {
    'PERFIL': 'perfil',
    'DIAGNÒSTIC': 'dificultats',
    'JUSTIFICACIÓ': 'justificacio',
    'ORIENTACIÓ': 'recomanacions', // Orientador/Docent
    'ORIENTACIÓ A L\'AULA': 'recomanacions',
    'ADAPTACIONS': 'adaptacions', // Orientador
    'ASSIGNATURES': 'adaptacions', // Docent
    'CRITERIS': 'avaluacio',
    'CRITERIS D\'AVALUACIÓ': 'avaluacio'
  };

  lines.forEach(line => {
    const trimmed = line.trim();
    // Detectem header markdown style: "## TÍTOL" o "### TÍTOL"
    if (trimmed.startsWith('#')) {
      const title = trimmed.replace(/^#+\s*/, '').toUpperCase();
      // Busquem si coincideix amb algun dels nostres
      const foundKey = Object.keys(sectionMap).find(k => title.includes(k));
      if (foundKey) {
        currentKey = sectionMap[foundKey];
        return; // Saltem la línia del títol
      }
    }

    // Afegim la línia a la secció actual
    if (trimmed.length > 0 && !trimmed.startsWith('```')) {
      result[currentKey].push(trimmed);
    }
  });

  return result;
}

module.exports = {
  checkConnection,
  generateSummaryLocal,
  parseSummaryToJSON
};