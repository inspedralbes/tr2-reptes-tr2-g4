const OpenAI = require("openai");

const defaultBase = "http://ollama:11434/v1"; 
const openai = new OpenAI({
    baseURL: process.env.AI_BASE_URL || defaultBase,
    apiKey: "sk-no-key-required", 
    timeout: 60 * 60 * 1000, 
});

async function checkConnection(retries = 100) {
    const baseUrl = process.env.AI_BASE_URL || defaultBase;
    const url = baseUrl.replace('/v1', ''); 
    
    console.log(`AI: Checking connection (${url})...`);

    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url);
            if (response.ok) {
                console.log("AI: Online (Ollama detected).");
                return true;
            }
            console.warn(`AI: Status ${response.status}...`);
        } catch (error) {
            if (i % 5 === 0) console.warn(`AI: Waiting for Ollama... (${error.message})`);
        }
        if (i < retries - 1) await new Promise(r => setTimeout(r, 3000));
    }
    return false;
}

async function generateSummaryLocal(text, role, onProgress) {
    await checkConnection(5); 

    const contextSize = parseInt(process.env.AI_CONTEXT_SIZE) || 16384;
    const threads = parseInt(process.env.AI_THREADS) || 6;
    const safeChars = Math.floor(contextSize * 1.5);
    const limit = role === 'global' ? safeChars : Math.floor(safeChars * 0.9);
    const truncatedText = text.length > limit ? text.substring(0, limit) + "..." : text;

    let systemPrompt = "";
    if (role === 'global') {
        systemPrompt = `Ets un assistent expert en educació inclusiva.
      OBJECTIU: Analitzar l'EVOLUCIÓ de l'alumne comparant els seus diferents Plans Individualitzats (PI) i les OBSERVACIONS dels docents, ordenats cronològicament.

      ESTRUCTURA OBLIGATÒRIA DEL RESUM:
      
      ## CRONOLOGIA I EVOLUCIÓ
      (Crea una llista cronològica on sintetitzis què es detectava a cada document i quines mesures es prenien.)
      
      ## ANÀLISI COMPARATIVA
      (Identifica canvis significatius: dificultats persistents, millores, canvis en el diagnòstic o en les adaptacions. Si només hi ha un document, analitza la seva rellevància històrica.)
      
      ## ESTAT ACTUAL (CURS VIGENT)
      (Resum de la situació actual. MOLT IMPORTANT: Si els documents PI són antics, prioritza la informació de les "OBSERVACIONS I COMENTARIS" més recents per descriure l'estat actual.)

      INSTRUCCIONS CLAU:
      - Sigues precís amb les dates i els cursos acadèmics.
      - Si detectes una mancança de documents recents, indica-ho però intenta extreure el màxim dels comentaris.
      - Utilitza un to professional i precís (terminologia psicopedagògica).
      - Utilitza llistes amb punts per a una millor llegibilitat.
      
      FINAL: Escriu "[FI]" quan acabis.`;
    } else if (role === 'orientador') {
        systemPrompt = `Ets un assistent expert per a orientadors educatius.
      OBJECTIU: Extreure informació psicopedagògica clau per a l'orientació de l'alumne.
      
      ESTRUCTURA OBLIGATÒRIA DEL RESUM:
      
      ## DADES DE L'ALUMNE
      (Extreu: Nom i cognoms, Data de naixement, Curs acadèmic i Estudis actuals. NO anonimitzis.)
      
      ## DIAGNÒSTIC
      (Quin és el diagnòstic? Detalla els trastorns detectats: TDAH, Dislèxia, TEA, etc.)

      ## JUSTIFICACIÓ
      (Motius principals i necessitats educatives que justifiquen el PI.)
      
      ## ORIENTACIÓ A L'AULA
      (Pautes clares d'intervenció educativa i metodològica.)
      
      ## ASSIGNATURES
      (Resum breu de les adaptacions per matèries. Sigues concís.)
      
      ## CRITERIS D'AVALUACIÓ
      (MOLT IMPORTANT: Normes específiques d'avaluació: ortografia, temps extra, tipus d'exàmens, etc.)

      INSTRUCCIONS:
      - Estructura la informació clarament amb negretes per a conceptes clau.
      - Sigues extremadament precís amb les dades de l'alumne.
      - Posa especial èmfasi en la secció d'Avaluació.
      
      FINAL: Escriu "[FI]" quan acabis.`;
    } else {
        systemPrompt = `Ets un assistent expert per a docents.
      OBJECTIU: Facilitar informació pràctica i directa per aplicar a l'aula immediatament.
      
      ESTRUCTURA OBLIGATÒRIA DEL RESUM:
      
      ## PERFIL I DIAGNÒSTIC
      (Resum ràpid: Nom, Curs i dificultat/trastorn principal.)
      
      ## ORIENTACIÓ A L'AULA
      (Accions concretes: "Seu a primera fila", "Fragments de text curts", "Dona més temps", etc.)
      
      ## ADAPTACIONS PER ASSIGNATURES
      (Què canvia en el temari, materials o activitats de les assignatures?)
      
      ## CRITERIS D'AVALUACIÓ
      (Com s'ha de puntuar? Ex: "No penalitzis ortografia", "Examen oral opcional", "Ús de calculadora", etc.)

      INSTRUCCIONS:
      - Utilitza un llenguatge molt pràctic i directe (ves al gra).
      - Evita teoria o descripcions genèriques.
      - Usa llistes per facilitar la lectura ràpida.
      
      FINAL: Escriu "[FI]" quan acabis.`;
    }

    const messages = [
        { role: "system", content: `${systemPrompt}\n\nINSTRUCCIONS: NO GENERIS JSON. Retorna només TEXT MARKDOWN. Escriu en CATALÀ.` },
        { role: "user", content: `DOCUMENT:\n"${truncatedText}"\n\nTASCA: Genera el resum.` }
    ];

    try {
        let fakeProgress = 0;
        let progressInterval = setInterval(() => {
            fakeProgress += 2; // Más lento ya que el modelo 8B es más pesado
            if (fakeProgress > 90) fakeProgress = 90; 
            if (onProgress) onProgress(null, fakeProgress, true);
        }, 1500);

        console.log(`AI: Sending prompt to Ollama (${process.env.AI_MODEL_NAME || "llama3.1:8b"})...`);
        
        const completion = await openai.chat.completions.create({
            model: process.env.AI_MODEL_NAME || "llama3.1:8b", 
            messages,
            temperature: 0.6,
            max_tokens: 4000,
            stream: true,
            stop: ["[FI]"],
            extra_body: {
                options: {
                    num_ctx: contextSize,
                    num_thread: threads
                }
            }
        });

        clearInterval(progressInterval); 
        
        let fullText = "";
        let chunkCount = 0;

        for await (const chunk of completion) {
            const content = chunk.choices[0]?.delta?.content || "";
            fullText += content;
            chunkCount++;
            
            if (onProgress && chunkCount % 5 === 0) {
                onProgress(undefined, 95, false); 
            }
        }

        return fullText;
    } catch (error) {
        console.error("AI: Generation failed:", error);
        throw error;
    }
}

function parseSummaryToJSON(text) {
    const result = {
        perfil: [], dificultats: [], justificacio: [], 
        adaptacions: [], avaluacio: [], recomanacions: []
    };
    if (!text) return result;
    const lines = text.split('\n');
    let currentKey = 'perfil';
    const sectionMap = {
        'PERFIL': 'perfil', 'DADES': 'perfil', 'CRONOLOGIA': 'perfil', 'EVOLUCIÓ': 'perfil',
        'DIAGNÒSTIC': 'dificultats', 'DIAGNOSTIC': 'dificultats', 'ANÀLISI': 'dificultats', 'ANALISI': 'dificultats',
        'MOTIU': 'justificacio', 'JUSTIFICACIÓ': 'justificacio', 'JUSTIFICACIO': 'justificacio',
        'ORIENTACIÓ': 'recomanacions', 'ORIENTACIO': 'recomanacions', 'ESTAT ACTUAL': 'recomanacions', 'RECOMANACIONS': 'recomanacions',
        'ADAPTACIONS': 'adaptacions', 'ASSIGNATURES': 'adaptacions', 
        'AVALUACIÓ': 'avaluacio', 'AVALUACIO': 'avaluacio', 'CRITERIS': 'avaluacio'
    };
    lines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('#')) {
            const title = trimmed.replace(/^#+\s*/, '').toUpperCase();
            const foundKey = Object.keys(sectionMap).find(k => title.includes(k));
            if (foundKey) { currentKey = sectionMap[foundKey]; return; }
        }
        if (trimmed.length > 0 && !trimmed.startsWith('```')) result[currentKey].push(trimmed);
    });
    return result;
}

module.exports = { checkConnection, generateSummaryLocal, parseSummaryToJSON };