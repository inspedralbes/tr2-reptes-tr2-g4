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

  // Retallem el text per no saturar el context del model
  const limit = role === 'global' ? 25000 : 14000;
  const MAX_CHARS = limit;
  const truncatedText = text.length > MAX_CHARS ? text.substring(0, MAX_CHARS) + "..." : text;

  let currentProgress = 0;

  // --- SELECCIÓ DE PROMPT SEGONS ROL ---
  let systemPrompt = "";
  let structureExample = "";

  if (role === 'global') {
    systemPrompt = "Ets un expert en educació especial. Genera un resum cronològic de l'historial de l'alumne en format JSON.";
    structureExample = `
EXEMPLE DE FORMAT JSON (Segueix-lo EXACTAMENT):
{
  "EVOLUCIÓ": ["L'alumne ha mostrat una millora...", "2020: Canvi d'etapa..."],
  "PUNTS CLAU RECURRENTS": ["Dificultat en atenció sostinguda", "Bona predisposició verbal"],
  "ADAPTACIONS CONSTANTS": ["Ús d'ordinador", "Temps extra a exàmens"],
  "ESTAT ACTUAL": ["Cursa 3r d'ESO", "Manté suports de la USEE"]
}`;

  } else if (role === 'orientador') {
    systemPrompt = `Ets un expert orientador psicopedagògic analitzant un Pla Individualitzat (PI).
    LA TEVA MISSIÓ: Extreure informació tècnica i legal detallada per a l'expediente de l'alumne.
    
    ESTRUCTURA OBLIGATÒRIA DEL JSON:
    1. "PERFIL": Resum de la situació actual, dades demogràfiques i historial rellevant.
    2. "DIAGNÒSTIC": Llistat exhaustiu de diagnòstics oficials i dificultats d'aprenentatge.
    3. "JUSTIFICACIÓ": Motius legals i pedagògics que emparen la creació del PI.
    4. "ORIENTACIÓ": Pautes de coordinació amb la família i suports externs.
    5. "ADAPTACIONS": Resum de les adaptacions metodològiques generals.
    6. "CRITERIS": Marc normatiu per a l'avaluació.`;

    structureExample = `
    {
      "PERFIL": ["L'alumne presenta una trajectòria de dificultats des de primària..."],
      "DIAGNÒSTIC": ["TDAH combinat", "Trastorn de l'aprenentatge no verbal"],
      "JUSTIFICACIÓ": ["Dictamen de l'EAP conforme a la Resolució ENS/1544/2013"],
      "ORIENTACIÓ": ["Seguiment mensual amb el CSMIJ", "Plataforma de comunicació diària amb pares"],
      "ADAPTACIONS": ["Adaptació curricular no significativa en continguts"],
      "CRITERIS": ["Avaluació per objectius mínims personalitzats"]
    }`;

  } else {
    // DOCENT (Default) - ENFOCAMENT A L'AULA
    systemPrompt = `Ets un psicopedagog expert ajudant a un MESTRE a entendre un PI.
    LA TEVA MISSIÓ: Donar consells pràctics i directes per aplicar demà mateix a l'aula.
    
    ESTRUCTURA OBLIGATÒRIA DEL JSON:
    1. "PERFIL": TEXT SEGUIT (narratiu) de 4-5 línies explicant qui és l'alumne de forma humana.
    2. "ORIENTACIÓ": Llistat DETALLAT de pautes per a l'aula (on asseure'l, com parlar-li, etc.).
    3. "ADAPTACIONS": Llistat per assignatura de què s'ha de canviar exactamente.
    4. "CRITERIS": Com puntuar els seus exàmens i treballs de forma justa.`;

    structureExample = `
    {
      "PERFIL": ["El Joan és un alumne molt creatiu però que es bloqueja amb la lectura..."],
      "ORIENTACIÓ": ["Asseure a primera fila", "Instruccions curtes i visuals"],
      "ADAPTACIONS": ["Mates: Menys exercicis", "Anglès: Exàmens orals"],
      "CRITERIS": ["Temps extra +30%", "No penalitzar faltes d'ortografia"]
    }`;
  }

  const messages = [
    {
      role: "system",
      content: `${systemPrompt}
      
      InSTRUCCIONS TÈCNIQUES:
      ✅ Retorna NOMÉS un objecte JSON vàlid.
      ✅ El "PERFIL" ha de ser un array amb UN SOL string llarg (text narratiu pur). NO facis llistes, NO separis per paràgrafs.
      ✅ "ORIENTACIÓ" ha de ser molt complet.
      
      ${structureExample}`
    },
    {
      role: "user",
      content: `Analitza aquest document PI i extreu-ne el JSON:\n\n"${truncatedText}"`
    }
  ];

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
        console.log("🔍 [aiService] Polling /slots...");
        const res = await fetch("http://pi_llm:8080/slots");
        if (res.ok) {
          const slots = await res.json();
          // DEBUG TOTAL: Veure què retorna la IA
          console.log("🔍 [LLM RAW SLOTS]:", JSON.stringify(slots));

          // Busquem el slot que realment està treballant
          const activeSlot = slots.find(s => s.is_processing === true || s.prompt_processing_progress > 0);

          let calculatedSlotProgress = 0;
          if (activeSlot) {
            let raw = activeSlot.prompt_processing_progress || 0;

            // Si no tenim prompt_processing_progress però is_processing és true, 
            // intentem calcular-lo a la vella usança
            if (raw === 0 && activeSlot.n_prompt > 0) {
              raw = activeSlot.n_past / activeSlot.n_prompt;
            }

            console.log(`🧠 Slot Actiu trobat: ID=${activeSlot.id}, Progress=${(raw * 100).toFixed(2)}%`);
            calculatedSlotProgress = Math.floor(raw * 100);
          } else {
            console.log("🔍 Cap slot processant actualment.");
          }

          if (calculatedSlotProgress > lastKnownProgress) {
            lastKnownProgress = calculatedSlotProgress;
            console.log(`🧠 [LLM] Slot processing: ${lastKnownProgress}% (Real)`);
            if (onProgress) onProgress(null, lastKnownProgress, true);
          }
        } else {
          console.warn(`⚠️ [aiService] /slots returned ${res.status}`);
        }
      } catch (e) {
        console.error("❌ [aiService] Polling error:", e.message);
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
          temperature: 0.1,
          max_tokens: 2048, // Augmentat per evitar JSON tallats
          stream: true,
          top_p: 0.9,
          presence_penalty: 0,
          frequency_penalty: 0
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
 * Xat ràpid amb el document.
 * @param {string} text - Text del document
 * @param {string} question - Pregunta de l'usuari
 */
async function chatWithDocument(text, question) {
  // OPTIMITZACIÓ EXTREMA: 1200 chars per velocitat màxima al xat
  const MAX_CHARS = 1200;
  const truncatedText = text.length > MAX_CHARS ? text.substring(0, MAX_CHARS) + "..." : text;

  const messages = [
    {
      role: "system",
      content: `Ets un motor de cerca semàntic.
            TASCA: Interpretar què vol l'usuari i trobar la frase LITERAL del text que ho respon, encara que no faci servir les mateixes paraules.
            
            EXEMPLES:
            - "comportament" -> Busca frases sobre "conducta", "actitud", "normes".
            - "què té?" -> Busca "diagnòstic", "trastorn", "dificultats".
            
            RESPOSTA: Retorna NOMÉS el fragment de text exacte del document. Si no ho trobes, digues NO_TROBAT.`
    },
    {
      role: "user",
      content: `DOCUMENT:\n"${truncatedText}"\n\nPREGUNTA: "${question}"\n\nRESPOSTA LITERAL DEL DOCUMENT:`
    }
  ];

  try {
    const completion = await openai.chat.completions.create({
      model: "default-model",
      messages: messages,
      temperature: 0.0, // Determinista (sempre la mateixa resposta)
      max_tokens: 60, // Molt curt (només volem la frase)
      stream: false
    });
    return completion.choices[0].message.content;
  } catch (error) {
    console.error("❌ Error Chat IA:", error);
    throw new Error("Error connectant amb la IA.");
  }
}

module.exports = { generateSummaryLocal, checkConnection, chatWithDocument };