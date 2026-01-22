const fs = require('fs');
const path = require('path');

// CONFIGURACIÓ OLLAMA NATIVA
const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://pi_llm:11434";
const MODEL_NAME = process.env.MODEL_NAME || "llama3.2:3b";

/**
 * Funció robusta per inicialitzar la IA.
 */
async function initializeAI() {
    const modelFileName = "Llama-3.2-3B-Instruct-Q4_K_M.gguf";
    const internalPath = `/app/models/${modelFileName}`;
    const ollamaPath = `/models/${modelFileName}`;

    console.log("🚀 [aiService] INICIANT SISTEMA D'INTEL·LIGÈNCIA ARTIFICIAL...");

    // Modificació: Saltem comprovació de fitxer local perquè usem model de llibreria (1B)
    /*
    if (!fs.existsSync(internalPath)) {
        console.error(`❌ [aiService] ERROR FATAL: No es troba el fitxer .gguf a: ${internalPath}`);
        return false;
    }
    */

    // BUCLE INFINIT DE CONNEXIÓ
    while (true) {
        try {
            // A. PING OLLAMA
            try {
                const health = await fetch(`${OLLAMA_HOST}/api/tags`);
                if (!health.ok) throw new Error(`Ollama status ${health.status}`);
            } catch (netErr) {
                console.warn("⏳ [aiService] Esperant a Ollama (pi_llm)...");
                await new Promise(r => setTimeout(r, 3000));
                continue;
            }

            console.log("✅ [aiService] Ollama connectat!");

            // B. CHECK/PULL MODEL
            const tagsRes = await fetch(`${OLLAMA_HOST}/api/tags`);
            const tagsData = await tagsRes.json();
            const exists = tagsData.models?.some(m => m.name === MODEL_NAME || m.name === `${MODEL_NAME}:latest`);

            if (exists) {
                console.log(`✅ [aiService] El model '${MODEL_NAME}' JA ESTÀ CARREGAT.`);
                break;
            }

            console.log(`⚙️ [aiService] EL MODEL NO EXISTEIX. DESCARREGANT '${MODEL_NAME}'...`);

            // USE PULL INSTEAD OF CREATE
            const pullRes = await fetch(`${OLLAMA_HOST}/api/pull`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: MODEL_NAME, stream: false })
            });

            if (!pullRes.ok) {
                const errText = await pullRes.text();
                throw new Error(`Error pull model: ${pullRes.status} - ${errText}`);
            }

            console.log("✅ [aiService] MODEL DESCARREGAT CORRECTAMENT.");
            break;

        } catch (error) {
            console.error("❌ [aiService] Error inicialització:", error.message);
            await new Promise(r => setTimeout(r, 5000));
        }
    }

    // C. WARM UP
    console.log("🔥 [aiService] Escalfant motor d'inferència...");
    try {
        await fetch(`${OLLAMA_HOST}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: MODEL_NAME,
                prompt: "hi",
                keep_alive: -1,
                stream: false
            })
        });
        console.log("🟢 [aiService] SISTEMA LLEST I OPERATIU. Model carregat en RAM.");
    } catch (e) {
        console.warn("⚠️ [aiService] Warm-up sense resposta: " + e.message);
    }

    return true;
}

const checkConnection = initializeAI;

/**
 * Genera un resum utilitzant IA LOCAL (sense streaming HTTP directe).
 * NADIU OLLAMA (Comportament del competidor)
 */
async function generateSummaryLocal(smartData, role) {
    let context = "";
    let metadata = {};

    // Detección de tipo de entrada (Objeto SmartParser vs Texto plano legacy)
    if (typeof smartData === 'string') {
        context = smartData;
    } else if (smartData && smartData.context) {
        context = smartData.context;
        metadata = smartData.metadata || {};
    } else {
        throw new Error("Format d'entrada invàlid per a la IA.");
    }

    // Neteja bàsica final
    let cleanContext = context.replace(/\n\s*\n/g, '\n').trim();
    if (cleanContext.length > 4500) cleanContext = cleanContext.substring(0, 4500) + "...";

    console.log(`🤖 [aiService] Generant resum per a: ${metadata.nom || 'Alumne'} (${cleanContext.length} chars enviats)`);

    // SYSTEM PROMPT OPTIMITZAT (INJECTANT METADADA)
    const SYSTEM_PROMPT = `
Ets un assistent expert en educació inclusiva.
DADES DE L'ALUMNE:
- Nom: ${metadata.nom || "No detectat"}
- Data Naixement: ${metadata.data || "No detectada"}
- Curs: ${metadata.curs || "No detectat"}
- Diagnòstic Previ: ${metadata.diagnostic || "No detectat"}

TASCA:
Analitza el text de la secció "Adaptacions" proporcionat i genera un resum JSON.
Ignora capçaleres repetitives. Si el text conté adaptacions explícites, llista-les.

FORMAT DE SORTIDA (JSON):
{
  "dadesAlumne": { "nomCognoms": "${metadata.nom || ''}", "dataNaixement": "${metadata.data || ''}", "curs": "${metadata.curs || ''}" },
  "motiu": { "diagnostic": "${metadata.diagnostic || ''}" },
  "adaptacionsGenerals": ["...llista neta d'adaptacions..."],
  "orientacions": ["...llista de pautes orientatives..."]
}
`;

    const prompt = `
    ${SYSTEM_PROMPT}

    CONTEXT (ADAPTACIONS / METODOLOGIA):
    """${cleanContext}"""

    GENERA EL JSON ARA.
    `;

    try {
        console.log(`🤖 [aiService] Enviant a Ollama (Mode Ràpid)...`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 600000); // 10 minuts (CPU lent)

        const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: MODEL_NAME,
                prompt: prompt,
                stream: false,
                keep_alive: "60m", // Mantenir en RAM 60 minuts
                format: "json", // Forcem sortida JSON nativa d'Ollama
                options: {
                    temperature: 0.1,
                    num_ctx: 2048,
                    top_k: 20,
                    top_p: 0.9
                }
            }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) throw new Error(`Ollama API error: ${response.status}`);

        const data = await response.json();
        const fullText = data.response;

        console.log(`🤖 [IA Local] Resposta REBUDA (${fullText.length} chars).`);

        // 1. INTENTAR NETEJAR MARKDOWN
        let jsonStr = fullText.replace(/```json\s*|\s*```/g, "").trim();

        // 2. INTENTAR PARSEJAR
        try {
            return JSON.parse(jsonStr);
        } catch (parseErr) {
            console.warn("⚠️ JSON invàlid. Intentant recuperar...", parseErr.message);

            // Intent d'extracció de JSON entre claus
            const start = fullText.indexOf('{');
            const end = fullText.lastIndexOf('}');

            if (start !== -1 && end !== -1) {
                try {
                    return JSON.parse(fullText.substring(start, end + 1));
                } catch (e) {
                    console.warn("⚠️ Fallada segon intent parseig. Retornant text cru.");
                }
            }

            // Fallback FINAL i DEFINITIU: Si tot falla, retornem el text estructurat
            // perquè el frontend el pugui pintar sense errors.
            return {
                dadesAlumne: { "nomCognoms": "No dectectat", "dataNaixement": "-", "curs": "-" },
                motiu: { diagnostic: "RESUM FORMAT TEXT (Vegis orientacions)" },
                adaptacionsGenerals: [],
                orientacions: [fullText] // Tot el text es mostra aquí
            };
        }

    } catch (error) {
        console.error("❌ Error IA Local:", error);
        return {
            error: "Error processant la resposta de la IA.",
            raw: error.message
        };
    }
}

/**
 * Xat ràpid amb el document.
 */
async function chatWithDocument(text, question) {
    const MAX_CHARS = 1200;
    const truncatedText = text.length > MAX_CHARS ? text.substring(0, MAX_CHARS) + "..." : text;

    const prompt = `
    Ets un cercador.
    DOCUMENT: "${truncatedText}"
    PREGUNTA: "${question}"
    RESPOSTA LITERAL O NO_TROBAT:
    `;

    try {
        const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: MODEL_NAME,
                prompt: prompt,
                stream: false,
                options: {
                    temperature: 0.0,
                    num_ctx: 2048
                }
            })
        });
        const data = await response.json();
        return data.response;
    } catch (error) {
        console.error("❌ Error Chat IA:", error);
        throw new Error("Error connectant amb la IA.");
    }
}

module.exports = { generateSummaryLocal, checkConnection, chatWithDocument };