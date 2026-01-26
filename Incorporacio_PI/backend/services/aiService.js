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

    const contextSize = parseInt(process.env.AI_CONTEXT_SIZE) || 4096;
    const safeChars = Math.floor(contextSize * 1.5);
    const limit = role === 'global' ? safeChars : Math.floor(safeChars * 0.9);
    const truncatedText = text.length > limit ? text.substring(0, limit) + "..." : text;

    let systemPrompt = "";
    if (role === 'global') {
        systemPrompt = `Ets un assistent expert en educacio inclusiva.
      OBJECTIU: Analitzar l'EVOLUCIO de l'alumne comparant els seus diferents Plans Individualitzats (PI) ordenats cronologicament.
      ESTRUCTURA OBLIGATORIA DEL RESUM:
      ## CRONOLOGIA I EVOLUCIO
      (Crea una llista per anys o cursos, ex: "Curs 2021-22", explicant que es detectava i que es feia.)
      ## ANALISI COMPARATIVA
      (Explica quines dificultats han persistit i quines han millorat. Comenta si les adaptacions han augmentat o disminuit.)
      ## ESTAT ACTUAL (CURS VIGENT)
      (Resum de la situacio a dia d'avui segons l'ultim document.)
      INSTRUCCIONS CLAU:
      - Cita explicitament els cursos academics o dates dels documents.
      - Busca contradiccions o canvis significatius entre documents antics i nous.
      - Sigues molt precis amb les dades.
      FINAL: Escriu "[FI]" quan acabis.`;
    } else if (role === 'orientador') {
        systemPrompt = `Ets un assistent expert per a orientadors educatius.
      OBJECTIU: Extreure informacio psicopedagogica clau per a l'orientacio de l'alumne.
      ESTRUCTURA OBLIGATORIA DEL RESUM:
      ## DADES DE L'ALUMNE
      (Extreu exactament: Nom i cognoms, Data de naixement, Curs acadèmic. NO anonimitzis.)
      ## DIAGNOSTIC
      (Quin es el diagnostic? TDAH, Dislèxia, etc.)
      ## JUSTIFICACIO
      (Per què es fa aquest PI? Motius i necessitats.)
      ## ORIENTACIO A L'AULA
      (Pautes clares d'intervenció.)
      ## ASSIGNATURES
      (Breu resum de les adaptacions específiques.)
      ## CRITERIS D'AVALUACIO
      (MOLT IMPORTANT: Normes específiques d'avaluació.)
      FINAL: Escriu "[FI]" quan acabis.`;
    } else {
        systemPrompt = `Ets un assistent expert per a docents.
      OBJECTIU: Facilitar informacio practica i directa.
      ESTRUCTURA OBLIGATORIA DEL RESUM:
      ## PERFIL I DIAGNOSTIC
      (Resum ràpid: Nom, Curs i dificultat.)
      ## ORIENTACIO A L'AULA
      (Accions concretes.)
      ## ADAPTACIONS PER ASSIGNATURES
      (Què canvia en el temari?)
      ## CRITERIS D'AVALUACIO
      (Com he de posar les notes?)
      FINAL: Escriu "[FI]" quan acabis.`;
    }

    const messages = [
        { role: "system", content: `${systemPrompt}\n\nINSTRUCCIONS: NO GENERIS JSON. Retorna només TEXT MARKDOWN. Escriu en CATALÀ.` },
        { role: "user", content: `DOCUMENT:\n"${truncatedText}"\n\nTASCA: Genera el resum.` }
    ];

    try {
        let fakeProgress = 0;
        let progressInterval = setInterval(() => {
            fakeProgress += 5;
            if (fakeProgress > 90) fakeProgress = 90; 
            if (onProgress) onProgress(null, fakeProgress, true);
        }, 1000);

        console.log(`AI: Sending prompt to Ollama...`);
        
        const completion = await openai.chat.completions.create({
            model: process.env.AI_MODEL_NAME || "llama3.2:3b", 
            messages,
            temperature: 0.7,
            max_tokens: 3000,
            stream: true,
            stop: ["[FI]"]
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
        'PERFIL': 'perfil', 'DADES': 'perfil',
        'DIAGNOSTIC': 'dificultats', 'MOTIU': 'justificacio', 'JUSTIFICACIO': 'justificacio',
        'ORIENTACIO': 'recomanacions', 'ADAPTACIONS': 'adaptacions', 
        'ASSIGNATURES': 'adaptacions', 'CRITERIS': 'avaluacio'
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