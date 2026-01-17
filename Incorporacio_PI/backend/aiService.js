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
            console.warn(`⚠️ [aiService] Intent ${i+1}/${retries} fallit: ${error.message}`);
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
  const MAX_CHARS = 6000; // Reduït encara més per garantir resposta ràpida en CPU
  const truncatedText = text.length > MAX_CHARS ? text.substring(0, MAX_CHARS) + "..." : text;

  let currentProgress = 0;
  
  // FASE 1: LECTURA
  // Eliminem la simulació. No enviarem progrés fals. El frontend mostrarà "Llegint..." sense barra o amb barra indeterminada.

  // --- SELECCIÓ DE PROMPT SEGONS ROL ---
  let systemPrompt = "";
  
  if (role === 'orientador') {
    // PROMPT PER A ORIENTADORS
    systemPrompt = `Ets un assistent expert per a orientadors educatius.
      OBJECTIU: Extreure informació clau per a l'orientació i seguiment de l'alumne.
      
      ESTRUCTURA OBLIGATÒRIA (5 SECCIONS):
      1. PERFIL DE L'ALUMNE (Dades personals i acadèmiques)
      2. DIAGNÒSTIC (Problemes detectats)
      3. JUSTIFICACIÓ DEL PI (Motiu del pla)
      4. ORIENTACIÓ A L'AULA (Pautes d'actuació)
      5. MATÈRIES (Adaptacions curriculars)

      FORMAT: "Idea clau molt breu. [[Detall: Text original...]]"`;
  } else {
    // PROMPT PER A DOCENTS (Defecte)
    systemPrompt = `Ets un assistent expert per a docents.
      OBJECTIU: Facilitar informació pràctica per a l'aula i l'avaluació.
      
      ESTRUCTURA OBLIGATÒRIA (5 SECCIONS):
      1. PERFIL DE L'ALUMNE (Dades personals i acadèmiques)
      2. DIAGNÒSTIC (Problemes detectats)
      3. ORIENTACIÓ A L'AULA (Pautes d'actuació)
      4. ASSIGNATURES (Adaptacions específiques)
      5. CRITERIS D'AVALUACIÓ (Com avaluar)

      FORMAT: "Idea clau molt breu. [[Detall: Text original...]]"`;
  }

  const messages = [
    {
      role: "system",
      content: `${systemPrompt}
      
      INSTRUCCIONS CRÍTIQUES DE FORMAT I CONTINGUT:
      1. TÍTOLS: Fes servir EXACTAMENT els títols de secció llistats amunt (en majúscules). Són OBLIGATORIS.
      2. FORMAT: Separa clarament cada secció amb un salt de línia.
      3. CONTINGUT COMPLET: Has d'incloure TOTA la informació rellevant que trobis al document per a cada secció. No resumeixis tant que es perdin dades.
      4. ESTIL LLISTA: Fes servir guions (-) o asteriscs (*) per a cada punt. Exemple: "- Més temps als exàmens". Evita paràgrafs llargs.
      5. NO COPIÏS LLISTES DE FORMULARI: Si veus opcions com "1r ESO, 2n ESO...", tria només la marcada o vigent.
      6. DETALLS: Extreu la frase literal clau del PDF dins dels claudàtors [[Detall: ...]].
      
      Processa tot el text proporcionat.`
    },
    {
      role: "user",
      content: `Analitza aquest PI i extreu-ne la informació rellevant:\n\n${truncatedText}`
    }
  ];

  try {
    console.log(`🤖 [aiService] Enviant petició a IA Local (http://pi_llm:8080/v1)...`);
    const completion = await openai.chat.completions.create({
      model: "default-model", // El nom és indiferent per a llama.cpp
      messages: messages,
      temperature: 0.1,
      max_tokens: 1000, // LIMITAT: Evita que s'enrotlli (la "chapa") i fa que acabi abans
      stream: true, // ACTIVEM STREAMING per veure el progrés
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
            // MODIFICAT: Ajustem a 800 tokens (resum curt) perquè la barra sigui realista
            // (chunkCount / 8) -> 800 tokens = 100%
            const chunkProgress = (chunkCount / 8); 
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

module.exports = { generateSummaryLocal, checkConnection };