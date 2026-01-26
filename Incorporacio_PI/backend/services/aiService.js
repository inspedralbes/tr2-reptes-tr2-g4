const OpenAI = require("openai");

// Configuracio del client per a IA LOCAL
const openai = new OpenAI({
    baseURL: process.env.AI_BASE_URL || "http://pi_llm:8080/v1",
    apiKey: "sk-no-key-required",
    timeout: 60 * 60 * 1000,
});

/**
 * Comprova si el contenidor de la IA esta disponible.
 */
async function checkConnection(retries = 100) {
    const url = (process.env.AI_BASE_URL || "http://pi_llm:8080/v1").replace('/v1', '/health');
    console.log(`AI: Checking connection (${url})...`);

    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url);
            if (response.ok) {
                console.log("AI: Online.");
                return true;
            }
            console.warn(`AI: Loading models (Status: ${response.status})...`);
        } catch (error) {
            console.warn(`AI: Attempt ${i + 1}/${retries} failed: ${error.message}`);
        }
        if (i < retries - 1) await new Promise(r => setTimeout(r, 3000));
    }
    return false;
}

/**
 * Genera un resum utilitzant IA LOCAL amb reintents i seguretat.
 */
async function generateSummaryLocal(text, role, onProgress) {
    const healthUrl = (process.env.AI_BASE_URL || "http://pi_llm:8080/v1").replace('/v1', '/health');
    let ready = false;
    let attempts = 0;
    while (!ready && attempts < 20) {
        try {
            const hRes = await fetch(healthUrl);
            if (hRes.ok) ready = true;
            else await new Promise(r => setTimeout(r, 3000));
        } catch (e) {
            await new Promise(r => setTimeout(r, 3000));
        }
        attempts++;
    }

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
      - Sigues molt precis amb els termes psicopedagogics.
      
      FINAL: Escriu "[FI]" quan acabis.`;
    } else if (role === 'orientador') {
        systemPrompt = `Ets un assistent expert per a orientadors educatius.
      OBJECTIU: Extreure informacio psicopedagogica clau per a l'orientacio de l'alumne.
      
      ESTRUCTURA OBLIGATORIA DEL RESUM:
      
      ## DADES DE L'ALUMNE
      (Extreu exactament: Nom i cognoms, Data de naixement, Curs acadèmic, Estudis actuals. NO anonimitzis les dades.)
      
      ## DIAGNOSTIC
      (Quin es el diagnostic? TDAH, Dislèxia, etc. Detalla els trastorns.)

      ## JUSTIFICACIO
      (Per què es fa aquest PI? Motius principals i necessitats educatives.)
      
      ## ORIENTACIO A L'AULA
      (Pautes clares d'intervenció educativa a l'aula.)
      
      ## ASSIGNATURES
      (Breu resum de les adaptacions específiques per matèries. "Un poco por encima".)
      
      ## CRITERIS D'AVALUACIO
      (MOLT IMPORTANT: Normes específiques d'avaluació. Com avaluar? Ortografia, temps extra, formats, etc.)

      INSTRUCCIONS:
      - Estructura la informació clarament.
      - Sigues precís amb les dades de l'alumne.
      - Posa emfasi en l'Avaluació.
      
      FINAL: Escriu "[FI]" quan acabis.`;
    } else {
        systemPrompt = `Ets un assistent expert per a docents.
      OBJECTIU: Facilitar informacio practica i directa per aplicar a l'aula immediatament.
      
      ESTRUCTURA OBLIGATORIA DEL RESUM:
      
      ## PERFIL I DIAGNOSTIC
      (Resum ràpid: Nom, Curs i quina dificultat/trastorn té.)
      
      ## ORIENTACIO A L'AULA
      (Accions concretes: "Seu a primera fila", "Dona més temps", etc.)
      
      ## ADAPTACIONS PER ASSIGNATURES
      (Què canvia en el temari o materials de les assignatures?)
      
      ## CRITERIS D'AVALUACIO
      (Com he de posar les notes? Ex: "No compten faltes", "Examen oral", etc.)

      INSTRUCCIONS:
      - Llenguatge molt pràctic.
      - Evita teoria innecessària, ves al gra.
      
      FINAL: Escriu "[FI]" quan acabis.`;
    }

    const messages = [
        { role: "system", content: `${systemPrompt}\n\nINSTRUCCIONS: NO GENERIS JSON. Retorna només TEXT MARKDOWN. Assegura't d'extreure les dades reals si es demanen.` },
        { role: "user", content: `DOCUMENT:\n"${truncatedText}"\n\nTASCA: Genera el resum seguint les instruccions.` }
    ];

    try {
        let pollReading = setInterval(async () => {
            try {
                const slotsUrl = (process.env.AI_BASE_URL || "http://pi_llm:8080/v1").replace('/v1', '/slots');
                const res = await fetch(slotsUrl);
                if (res.ok) {
                    const slots = await res.json();
                    const activeSlot = slots.find(s => s.is_processing === true);
                    if (activeSlot) {
                        let isGenerating = activeSlot.next_token?.length > 0 && activeSlot.next_token[0].n_decoded > 0;
                        if (isGenerating) {
                            if (onProgress) onProgress(null, 100, false);
                            clearInterval(pollReading);
                            return;
                        }
                        let raw = activeSlot.prompt_processing_progress || (activeSlot.n_prompt > 0 ? activeSlot.n_past / activeSlot.n_prompt : 0);
                        if (raw > 0 && onProgress) onProgress(null, Math.floor(raw * 100), true);
                    }
                }
            } catch (e) { }
        }, 2000);

        let tries = 0;
        const maxTries = 3;
        let completion = null;

        while (tries < maxTries) {
            try {
                console.log(`AI: Attempt ${tries + 1}/${maxTries} invoking LLM...`);
                completion = await openai.chat.completions.create({
                    model: "default-model",
                    messages,
                    temperature: 0.7,
                    max_tokens: 3000,
                    stream: true,
                    stop: ["[FI]"]
                });
                break;
            } catch (openaiErr) {
                tries++;
                console.error(`AI Error attempt ${tries}:`, openaiErr.message);
                if (tries >= maxTries) throw openaiErr;
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        clearInterval(pollReading);
        let fullText = "";
        let chunkCount = 0;

        for await (const chunk of completion) {
            const content = chunk.choices[0]?.delta?.content || "";
            fullText += content;
            chunkCount++;

            // Send progress update ONLY for the percentage/spinner, NOT the text.
            // Sending 'undefined' as text prevents the frontend/DB from updating the summary content partially.
            if (onProgress && chunkCount % 10 === 0) {
                await onProgress(undefined, Math.min(Math.floor(chunkCount / 2), 99), false);
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
        perfil: [],
        dificultats: [],
        justificacio: [],
        adaptacions: [],
        avaluacio: [],
        recomanacions: []
    };
    if (!text) return result;
    const lines = text.split('\n');
    let currentKey = 'perfil';
    const sectionMap = {
        'PERFIL': 'perfil',
        'DADES': 'perfil',
        'DIAGNOSTIC': 'dificultats',
        'MOTIU': 'justificacio',
        'JUSTIFICACIO': 'justificacio',
        'ORIENTACIO': 'recomanacions',
        'ADAPTACIONS': 'adaptacions',
        'ASSIGNATURES': 'adaptacions',
        'CRITERIS': 'avaluacio'
    };
    lines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('#')) {
            const title = trimmed.replace(/^#+\s*/, '').toUpperCase();
            const foundKey = Object.keys(sectionMap).find(k => title.includes(k));
            if (foundKey) {
                currentKey = sectionMap[foundKey];
                return;
            }
        }
        if (trimmed.length > 0 && !trimmed.startsWith('```')) {
            result[currentKey].push(trimmed);
        }
    });
    return result;
}

module.exports = { checkConnection, generateSummaryLocal, parseSummaryToJSON };
