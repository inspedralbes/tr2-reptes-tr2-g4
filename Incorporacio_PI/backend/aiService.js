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

  // Regla de 3 aproximada: 1 token ~= 3-4 chars. Reservem 50% per la resposta i prompt system.
  // 4096 -> ~12k chars total. 
  // Reduïm límit de document per deixar espai al nou prompt llarg.
  const safeChars = Math.floor(contextSize * 1.5);

  const limit = role === 'global' ? safeChars : Math.floor(safeChars * 0.9); // Augmentem límit al 90%
  const MAX_CHARS = limit;
  const truncatedText = text.length > MAX_CHARS ? text.substring(0, MAX_CHARS) + "..." : text;

  let currentProgress = 0;

  // --- SELECCIÓ DE PROMPT SEGONS ROL ---
  let systemPrompt = "";
  let structureExample = ""; // JA NO ES FA SERVIR (Integrat al prompt)

  if (role === 'global') {
    systemPrompt = `Ets un assistent expert en educació.
      OBJECTIU: Generar un resum global i cronològic de l'evolució de l'alumne basant-se en tots els seus Plans Individualitzats (PI).
      
      ESTRUCTURA OBLIGATÒRIA (Usa exactament aquests encapçalaments tancats amb '#'):
      ## EVOLUCIÓ
      (Descripció detallada del progrés. IMPORTANT: No inventis el curs actual. Si el document no ho diu clarament, digues "Curs no especificat".)
      ## PUNTS CLAU RECURRENTS
      (Explicació completa dels diagnòstics o dificultats que es repeteixen.)
      ## ADAPTACIONS CONSTANTS
      (Mesures mantingudes en el temps, explicades detalladament.)
      ## ESTAT ACTUAL
      (Situació segons l'ÚLTIM document per data o context. Sigues precís i extens amb el curs i les necessitats actuals.)
      
      FORMAT: Text net sense títol principal.
      FINAL: Quan acabis, escriu exclusivament "[FI]" al final del text.`;

  } else if (role === 'orientador') {
    // PROMPT PER A ORIENTADORS
    systemPrompt = `Ets un assistent expert per a orientadors educatius.
      OBJECTIU: Extreure informació clau per a l'orientació i seguiment de l'alumne.
      IMPORTANT: NO posis títol principal al document (com "Resum..."). Comença directament amb la primera secció.
      
      ESTRUCTURA OBLIGATÒRIA (Usa exactament aquests encapçalaments tancats amb '#'):
      ## PERFIL
      (Descripció detallada de l'alumne. Extensió lliure, no et limitis a un paràgraf si cal més.)
      ## DIAGNÒSTIC
      (Diagnòstic complet i observacions detallades.)
      ## JUSTIFICACIÓ
      (Explicació detallada del motiu del PI basat en el diagnòstic.)
      ## ORIENTACIÓ A L'AULA
      (Pautes d'actuació i cohesió social detallades.)
      ## ADAPTACIONS
      (Llista completa i detallada de les adaptacions curriculars.)
      ## CRITERIS D'AVALUACIÓ
      (Explicació dels criteris d'avaluació.)
 
      FORMAT GENERAL: "Idea clau. [[Detall extens: text original...]]"
      FINAL: Quan acabis, escriu exclusivament "[FI]" al final del text.`;

  } else {
    // DOCENT (Default) - DIAGNÒSTIC INTEGRAT A PERFIL
    systemPrompt = `Ets un assistent expert per a docents.
      OBJECTIU: Facilitar informació pràctica per a l'aula.
      IMPORTANT: NO posis títol principal. Comença directament amb la primera secció.
      
      ESTRUCTURA OBLIGATÒRIA (Usa exactament aquests encapçalaments tancats amb '#'):
      ## PERFIL
      (Descriu detalladament l'alumne i inclou el seu DIAGNÒSTIC aquí mateix. Extensió lliure.)
      ## ORIENTACIÓ A L'AULA
      (Pautes d'actuació docent explicades amb detall.)
      ## ASSIGNATURES
      (Llista detallada d'adaptacions per matèria.)
      ## CRITERIS D'AVALUACIÓ
      (Com avaluar. Explicació detallada.)
 
      FORMAT GENERAL: "Idea clau. [[Detall extens: text original...]]"
      FINAL: Quan acabis, escriu exclusivament "[FI]" al final del text.`;
  }

  const messages = [
    {
      role: "system",
      content: `${systemPrompt}
      
      INSTRUCCIONS CRÍTIQUES DE FORMAT I CONTINGUT:
      1. TÍTOLS OBLIGATORIS: Genera SEMPRE les 5 seccions exactes llistades amunt.
      2. CONTINGUT COMPLET: Has d'incloure TOTA la informació rellevant que trobis al document per a cada secció.
      3. ESTIL LLISTA: Fes servir guions (-) o asteriscs (*) per a cada punt, excepte en Perfil/Diagnòstic/Justificació on vull paràgrafs.
      4. NO COPIÏS LLISTES DE FORMULARI: Si veus opcions com "1r ESO, 2n ESO...", tria només la marcada o vigent.
      5. DETALLS: Extreu la frase literal clau del PDF dins dels claudàtors [[Detall: ...]].
      6. ANONIMITZACIÓ: NO incloguis MAI el nom de l'alumne. Substitueix-lo per "L'alumne/a".
      7. NETEJA FINAL: El document acaba sovint amb signatures. Ignora-les.
      8. ANTI-AL·LUCINACIÓ: Si no trobes informació sobre un punt, digues "No s'especifica".

      IMPORTANT: **NO** GENERIS JSON. Retorna només TEXT MARKDOWN.`
    },
    {
      role: "user",
      content: `DOCUMENT:\n"${truncatedText}"\n\nTASCA: Genera el resum seguint les instruccions.`
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
      let calculatedSlotProgress = 0; // Initialize variable to avoid ReferenceError
      try {
        // console.log("🔍 [aiService] Polling /slots..."); // SILENCIAT PER PETICIÓ USUARI
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 500); // 500ms timeout

        const res = await fetch("http://pi_llm:8080/slots", { signal: controller.signal });
        clearTimeout(timeoutId);
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
              if (onProgress) onProgress(null, 0, false); // Fix: isReading=false per canviar estat a GENERANT
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
            // console.log("🔍 Cap slot processant actualment."); // SILENCIAT
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
        // Ignorem errors de timeout puntuals (HeadersTimeoutError) que són normals amb càrrega alta
        if (e.message && e.message.includes('HeadersTimeout')) return;
        console.error("❌ [aiService] Polling error:", e.cause || e.message);
      }
    }, 2000); // Polling cada 2s per reduir càrrega al servidor

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
          frequency_penalty: 0.1,
          stop: ["[FI]"] // STOP TOKEN per tallar en sec
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

    console.log(`🤖 [IA Local] Generació finalitzada. Longitud: ${fullText.length}. Validant format...`);

    // --- SAFETY NET: CONVERSIÓ JSON -> MARKDOWN ---
    // Detectem si hi ha un bloc JSON, encara que estigui envoltat de text
    const jsonMatch = fullText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        console.warn("⚠️ [aiService] La IA ha retornat JSON. Intentant recuperar text...");
        const jsonStr = jsonMatch[0];
        const json = JSON.parse(jsonStr);
        let md = "";

        // Funció recursiva per extreure text de qualsevol estructura (objectes, arrays, strings JSON)
        const extractText = (val) => {
          if (!val) return "";

          // Si és array, processem cada element
          if (Array.isArray(val)) {
            return val.map(extractText).join("\n");
          }

          // Si és string
          if (typeof val === 'string') {
            val = val.trim();
            // Si el string sembla un altre JSON (cas del "parameters"), intentem parsejar-lo
            if ((val.startsWith('{') || val.startsWith('[')) && val.length > 2) {
              try {
                const innerC = JSON.parse(val);
                return extractText(innerC);
              } catch (e) {
                // Si no és JSON vàlid, és text normal.
                // Netejem cometes o claus residuals si n'hi ha moltes
                if (val.includes('":"')) return val; // Sembla JSON trencat
                return val.replace(/^["'{}\[\]]+|["'{}\[\]]+$/g, '');
              }
            }
            return val;
          }

          // Si és objecte
          if (typeof val === 'object') {
            // Ignorem claus tècniques
            let res = "";
            for (const [k, v] of Object.entries(val)) {
              if (['name', 'parameters', 'type'].includes(k)) {
                res += extractText(v) + "\n";
              } else {
                // Tractem la clau com a possible subtítol si el valor és llarg
                const content = extractText(v);
                if (content.length > 20) res += `\n**${k.toUpperCase()}**: ${content}`;
                else res += `${content} `;
              }
            }
            return res;
          }

          return String(val);
        };

        // Map de camps principals
        const map = {
          'perfil': "## PERFIL DE L'ALUMNE",
          'perfil_alumne': "## PERFIL DE L'ALUMNE",
          'dificultats': "## PUNTS FORTS I FEBLES",
          'diagnostic': "## PUNTS FORTS I FEBLES",
          'orientacio': "## ORIENTACIONS A L'AULA",
          'recomanacions': "## ORIENTACIONS A L'AULA",
          'adaptacions': "## ADAPTACIONS CURRICULARS",
          'materies': "## ADAPTACIONS CURRICULARS",
          'avaluacio': "## CRITERIS D'AVALUACIÓ"
        };

        // Recorrem les claus del JSON i muntem el markdown
        for (const [key, val] of Object.entries(json)) {
          let header = map[key.toLowerCase()];
          if (!header && key.length > 2) header = `## ${key.toUpperCase()}`;

          const content = extractText(val).trim();

          if (content.length > 5) {
            if (header) md += `\n\n${header}\n`;
            // Convertim en llista si té salts de línia
            md += content.split('\n').map(line => line.trim()).filter(l => l).map(l => `- ${l}`).join('\n') + "\n";
          }
        }

        if (md.length > 20) {
          fullText = md;
          console.log("✅ [aiService] JSON complex convertit a Markdown net.");
        }
      } catch (e) {
        console.error("❌ [aiService] Error safety net JSON:", e);
      }
    }

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