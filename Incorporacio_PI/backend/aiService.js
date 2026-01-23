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
  // Si és un resum global, permetem molt més context per encabir diversos documents (aprox 10.000 tokens)
  const limit = role === 'global' ? 40000 : 25000;
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
      OBJECTIU: Generar un resum global, profund i cronològic de l'evolució de l'alumne.
      
      ESTRUCTURA OBLIGATÒRIA:
      1. **EVOLUCIÓ**: Progrés des del primer document. Detecta canvis de centre o de suport (SIEI, ordinària).
      2. **PUNTS CLAU RECURRENTS**: Diagnòstics tècnics (Paresia, TDAH, Dislèxia) i barreres.
      3. **ADAPTACIONS CONSTANTS**: Mesures de suport que persisteixen (Auxiliars, Fisioteràpia).
      4. **ESTAT ACTUAL**: Prioritats de l'últim curs (3r ESO, 4t ESO, etc.).

      FORMAT: Text professional i directe.`;
  } else if (role === 'orientador') {
    // PROMPT PER A ORIENTADORS
    systemPrompt = `Ets un assistent expert per a orientadors educatius.
      OBJECTIU: Extraure informació tècnica i jurídica del PI.
      
      ESTRUCTURA OBLIGATÒRIA:
      1. PERFIL DE L'ALUMNE: Descripció biopsicosocial i fets rellevants (adoptat, nouvingut, etc.).
      2. DIAGNÒSTIC I NECESSITATS: Diagnòstic literal (ej: Tetraparèsia espàstica, Dislèxia severa). Menciona el grau de discapacitat (CAD %) si apareix.
      3. JUSTIFICACIÓ DEL PI: Motiu de l'elaboració (Dictamen, NESE, etc.).
      4. MESURES I SUPORTS: Professionals que intervenen (SIEI, EAP, Fisioterapeuta, Auxiliar). Menciona l'equipament (Tobii, Braille, Tablet).
      5. SEGUIMENT PER MATÈRIES: Llistat d'assignatures i nivell d'assoliment.

      FORMAT: "Idea clau. [[Detall: Text literal...]]"`;
  } else {
    // PROMPT PER A DOCENTS (Defecte)
    systemPrompt = `Ets un assistent expert per a professors d'aula.
      OBJECTIU: Guia pràctica per saber com treballar amb l'alumne.
      
      ESTRUCTURA OBLIGATÒRIA:
      1. PERFIL DE L'ALUMNE: Com aprèn i quin caràcter té (autoexigent, participatiu, tímid).
      2. DIAGNÒSTIC: Resum entenedor del diagnòstic i el curs actual.
      3. ORIENTACIÓ A L'AULA: Metodologia concreta (Tobii-Eye Tracking, ordinador, Braille, més temps, enunciats curts).
      4. ASSIGNATURES I MATÈRIES: Llistat exhaustiu de cada matèria detectada al document amb les seves adaptacions.
      5. CRITERIS D'AVALUACIÓ: Molt important: com s'ha de qualificar (ej: no penalitzar faltes, valorar contingut sobre forma, ús de calculadora).

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
      model: "default-model",
      messages: messages,
      temperature: 0.1,
      max_tokens: 4000, // AUGMENTAT: 4000 tokens per permetre resums molt detallats sense talls
      stream: true,
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