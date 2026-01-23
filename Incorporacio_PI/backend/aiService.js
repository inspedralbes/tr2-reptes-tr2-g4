const OpenAI = require("openai");

// Configuració del client per a IA LOCAL
const openai = new OpenAI({
  baseURL: "http://pi_llm:8080/v1", // MODIFICAT: Connecta amb 'pi_llm' (nom real del contenidor)
  apiKey: "sk-no-key-required",  // La IA local no necessita clau real
  timeout: 30 * 60 * 1000,       // NOU: 30 minuts de timeout (augmentat per si va lent)
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

        // NOU: Test real de generació per confirmar que "pensa"
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

  // Retallem el text per no saturar el context del model
  // Si és un resum global, permetem més context per encabir diversos documents
  const limit = role === 'global' ? 15000 : 12000; // AUGMENTAT: Tornem a la "vella escola" (més qualitat, encara que trigui més)
  const MAX_CHARS = limit;
  const truncatedText = text.length > MAX_CHARS ? text.substring(0, MAX_CHARS) + "..." : text;

  let currentProgress = 0;

  // FASE 1: LECTURA
  // Eliminem la simulació. No enviarem progrés fals. El frontend mostrarà "Llegint..." sense barra o amb barra indeterminada.

  // --- SELECCIÓ DE PROMPT SEGONS ROL ---
  let systemPrompt = "";

  if (role === 'global') {
    // PROMPT PER A RESUM GLOBAL (Historial)
    systemPrompt = `Ets un assistent expert en educació especialITZADA.
      OBJECTIU: Generar un resum global, profund i cronològic de l'evolució de l'alumne basant-se en tots els seus Plans Individualitzats (PI).
      
      ESTRUCTURA OBLIGATÒRIA (Usa exactament aquests títols en majúscules i negreta):
      1. **EVOLUCIÓ**: Descripció detallada del progrés des del primer document fins a l'últim.
      2. **PUNTS CLAU RECURRENTS**: Diagnòstics, barreres d'aprenentatge o dificultats que persisteixen.
      3. **ADAPTACIONS CONSTANTS**: Mesures de suport que s'han mantingut i han demostrat ser efectives.
      4. **ESTAT ACTUAL**: Resum de la situació actual segons l'últim PI. Identifica clarament el curs actual i les prioritats de treball.

      FORMAT: Text professional i empàtic. No posis títols de presentació.`;
  } else if (role === 'orientador') {
    // PROMPT PER A ORIENTADORS
    systemPrompt = `Ets un assistent expert per a orientadors educatius (EAP/Psicopedagogs).
      OBJECTIU: Extraure informació tècnica i d'orientació crucial.
      
      ESTRUCTURA OBLIGATÒRIA:
      1. PERFIL DE L'ALUMNE: Descripció biopsicosocial del cas (paràgraf).
      2. DIAGNÒSTIC I NECESSITATS: Detalla el diagnòstic clínic/educatiu i les necessitats específiques (paràgraf).
      3. JUSTIFICACIÓ DEL PI: Per què es realitza aquest pla i quins són els objectius prioritaris (paràgraf).
      4. MESURES I SUPORTS: Pautes d'intervenció i coordinació.
      5. SEGUIMENT PER MATÈRIES: Llista Totes les assignatures amb adaptacions.

      FORMAT: "Idea clau. [[Detall: Text literal...]]"`;
  } else {
    // PROMPT PER A DOCENTS (Defecte)
    systemPrompt = `Ets un assistent expert per a professors d'aula.
      OBJECTIU: Crear una guia pràctica i molt detallada per saber com treballar amb l'alumne demà mateix.
      
      ESTRUCTURA OBLIGATÒRIA:
      1. PERFIL DE L'ALUMNE: Qui és l'alumne i com aprèn millor.
      2. DIAGNÒSTIC: Resultats de l'avaluació psicopedagògica de forma entenedora.
      3. ORIENTACIÓ A L'AULA: Consells concrets per a la gestió de l'aula i la metodologia.
      4. ASSIGNATURES I MATÈRIES: Llistat exhaustiu de cada matèria detectada al document amb les seves adaptacions.
      5. CRITERIS D'AVALUACIÓ: Instruccions precises sobre com s'ha de qualificar l'alumne.

      FORMAT: "Resum executiu. [[Detall: Cita literal del document...]]"`;
  }

  const messages = [
    {
      role: "system",
      content: `${systemPrompt}
      
      INSTRUCCIONS CRÍTIQUES DE FORMAT I CONTINGUT:
      1. TÍTOLS OBLIGATORIS: Genera SEMPRE les seccions exactes.
      2. ANONIMITZACIÓ: Substitueix el nom de l'alumne per "L'alumne/a".
      3. DETECCIÓ DE MATÈRIES (MOLT IMPORTANT): El document sol tenir taules amb assignatures (Català, Castellà, Matemàtiques, Anglès, etc.). Has de llistar-les ABSOLUTAMENT TOTES. No te'n deixis cap.
      4. DETALLS LITERALS: Dins de [[Detall: ...]] has de posar el contingut literal, especialment en ASSIGNATURES i CRITERIS D'AVALUACIÓ. Si el document diu "Adapació de continguts: ...", copia-ho tot.
      5. EVITA RESUMS GENÈRICS: Si el document diu coses específiques de Matemàtiques, no digues "adaptacions en general", digues exactament què es fa en Matemàtiques.
      6. BUSCA EL CURS: Identifica a quin curs pertany el document (1r ESO, 2n Primària, etc.) i menciona'l al perfil.
      7. NO INVENTIS: Si una secció no té informació al text, simplement no la posis o digues "Informació no disponible al document".
      8. NO ASTERISCS: No usis asteriscs (*) ni guions (-) per llistes, usa paràgrafs o salts de línia nets.
      
      Analitza el següent text amb màxima atenció als detalls acadèmics:`
    },
    {
      role: "user",
      content: `DOCUMENT PI:\n\n${truncatedText}`
    }
  ];

  try {
    console.log(`🤖 [aiService] Enviant petició a IA Local (http://pi_llm:8080/v1)...`);
    const completion = await openai.chat.completions.create({
      model: "default-model", // Tornem al model principal (Llama)
      messages: messages,
      temperature: 0.1,
      max_tokens: 2000, // RESTAURAT: 2000 tokens per permetre resums llargs
      stream: true, // ACTIVEM STREAMING per veure el progrés
      top_p: 0.9,
      presence_penalty: 0,
      frequency_penalty: 0
    });

    console.log("🤖 [aiService] Connexió establerta amb LLM! Esperant el primer token (Fase de Lectura/Pre-fill)...");

    let fullText = "";
    // Seccions esperades per calcular el progrés (aprox 20% per secció)
    // MODIFICAT: Keywords actualitzades segons els nous prompts (Docent/Orientador)
    const sections = ["PERFIL", "DADES", "DIAGNÒSTIC", "ORIENTACIÓ", "ADAPTACIONS", "MATÈRIES", "ASSIGNATURES", "CRITERIS", "JUSTIFICACIÓ"];
    let isFirst = true;
    let chunkCount = 0;

    for await (const chunk of completion) {
      // FASE 2: ESCRIPTURA (Reset a 0% -> 100%)
      if (isFirst) {
        console.log("🤖 [aiService] Primer token rebut! Comença la generació de text.");
        isFirst = false;
        currentProgress = 0; // Reiniciem la barra per a la fase d'escriptura
      }

      chunkCount++;
      const content = chunk.choices[0]?.delta?.content || "";

      // Log de "batec" cada 10 chunks per veure que està viu a la terminal (Més freqüent)
      if (chunkCount % 10 === 0) {
        console.log(`... generant (${chunkCount} tokens)`); // Més visible als logs de Docker
      }

      fullText += content;

      if (onProgress) {
        // Càlcul simple de progrés: Quantes seccions hem trobat ja?
        let foundCount = 0;
        sections.forEach(s => {
          if (fullText.includes(s)) foundCount++;
        });

        // Càlcul de progrés d'escriptura (0 a 100)
        // MODIFICAT: Ajustem a 2000 tokens (resum complet)
        // (chunkCount / 20) -> 2000 tokens = 100%
        const chunkProgress = (chunkCount / 20);
        const sectionProgress = foundCount * 5; // Més pes a les seccions per compensar

        let writeProgress = chunkProgress + sectionProgress;

        // Enviem text ple -> Servidor marca "GENERANT..."
        // AWAIT IMPORTANT: Esperem que s'actualitzi la BD abans de continuar per evitar race conditions al final
        await onProgress(fullText, Math.min(Math.floor(writeProgress), 99));
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