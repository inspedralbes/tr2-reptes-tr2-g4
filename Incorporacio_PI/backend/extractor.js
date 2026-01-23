const path = require('path');
const { parseFile } = require('./smartParser');

// Use the internal container URL for Ollama
// Use dynamic URL from env or default
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://ollama:11434';
const OLLAMA_URL = `${OLLAMA_HOST}/api/generate`;
const MODEL_NAME = process.env.MODEL_NAME || 'llama3.2:3b';

async function extractPIdata(filesInput, role = 'docente') {
    // Normalize input: allow single file (legacy) or array
    const files = Array.isArray(filesInput) ? filesInput : [{ path: filesInput, name: arguments[1] || 'Unknown' }];

    console.log(`📂 extracting data from ${files.length} sources (Role: ${role})...`);

    let aggregatedContext = "";
    let baseMetadata = {}; // Metadata from the LATEST file (most relevant for current status)

    // 1. EXTRACT DATA FROM ALL FILES
    for (const [index, file] of files.entries()) {
        try {
            console.log(`   📄 Reading: ${file.name}`);
            const parsedData = await parseFile(file.path, file.name); // Using smartParser

            if (parsedData) {
                const dateStr = file.date ? new Date(file.date).toISOString().split('T')[0] : "Unknown Date";
                aggregatedContext += `\n\n--- DOCUMENT ${index + 1} (${file.name} - ${dateStr}) ---\n`;
                aggregatedContext += parsedData.context;

                // Update base metadata (overwrite with newer files as loop proceeds chronologically)
                if (parsedData.metadata.nom) baseMetadata.nom = parsedData.metadata.nom;
                if (parsedData.metadata.curs) baseMetadata.curs = parsedData.metadata.curs;
                if (parsedData.metadata.diagnostic) baseMetadata.diagnostic = parsedData.metadata.diagnostic;
            }
        } catch (e) {
            console.error(`   ⚠️ Error reading ${file.name}:`, e.message);
        }
    }

    if (!aggregatedContext) {
        throw new Error("ABORT_JOB: No content to process.");
    }

    // 2. CONSTRUCT PROMPT BASED ON ROLE
    let jsonStructure = "";
    let roleInstructions = "";

    if (role === 'orientador') {
        jsonStructure = `{
            "perfil": {
                "nomCognoms": "",
                "dataNaixement": "",
                "curs": ""
            },
            "diagnostic": "",
            "justificacio": "", 
            "necessitats": [],
            "interessos": [],
            "adaptacions": [], 
            "orientacions": []
        }`;

        roleInstructions = `
        1. **perfil**: Extreu Nom, Data Naixement i Curs.
        2. **diagnostic**: Diagnòstic tècnic (ex: "Dislèxia", "TDAH", "NESE", "Tetraparèsia").
        3. **justificacio**: Breu explicació del motiu del PI.
        4. **necessitats**: Llista de barreres o necessitats detectades.
        5. **interessos**: Fortaleses i interessos de l'alumne.
        6. **adaptacions**: Extracció EXTENSA de totes les mesures (universals, addicionals, intensives).
        7. **orientacions**: Orientacions per a la família i l'equip docent.
        `;

    } else if (role === 'historial') {
        jsonStructure = `{
            "evolució": "Resum de com ha evolucionat l'alumne des del primer document fins a l'últim.",
            "puntsClauRecurrents": "Llista de dificultats o fortaleses que apareixen sistemàticament en tots els PIs.",
            "adaptacionsConstants": "Mesures que s'han mantingut al llarg del temps.",
            "estatActual": "Situació resumida segons l'últim document disponible."
        }`;

        roleInstructions = `
        1. Compara tots els documents proporcionats.
        2. **evolució**: Descriu els canvis acadèmics i personal de l'alumne.
        3. **puntsClauRecurrents**: Identifica patrons que es repeteixen (ex: falta de concentració, bona disposició).
        4. **adaptacionsConstants**: Indica quines mesures (temps extra, materials adaptats) han estat una constant.
        5. **estatActual**: Breu resum de la situació actual de l'alumne.
        `;

    } else {
        jsonStructure = `{
            "perfil": {
                "nomCognoms": "",
                "curs": ""
            },
            "diagnostic": "",
            "prioritats": [],
            "orientacioAula": [], 
            "assignatures": [
                { "materia": "Name", "continguts": "Adaptació", "avaluacio": "Criteris" }
            ], 
            "criterisAvaluacioGeneral": []
        }`;

        roleInstructions = `
        1. **perfil**: Nom i Curs.
        2. **diagnostic**: Tipus de trastorn o dificultat.
        3. **prioritats**: Què és el més important a treballar amb aquest alumne aquest curs?
        4. **orientacioAula**: Consells pràctics i immediats (posició a l'aula, ús d'agenda, temps extra, instruccions curtes).
        5. **assignatures**: Per a cada matèria esmentada (Català, Anglès, Mates, etc.), extreu el contingut adaptat i com s'ha d'avaluar.
        6. **criterisAvaluacioGeneral**: Criteris que afecten a tots els exàmens (ortografia no penalitza, oralitat, glossari de termes).
        `;
    }

    // OPTIMIZATION: Context management
    const contextLength = aggregatedContext.length;
    console.log(`📊 Total Context Length: ${contextLength} characters.`);

    const safeContext = aggregatedContext.length > 40000 ? aggregatedContext.substring(0, 40000) + "... [TRUNCATED]" : aggregatedContext;

    const prompt = `
    Ets un expert en pedagogia i extracció de dades per a Plans Individualitzats (PI) a Catalunya.
    Rol: ${role.toUpperCase()}.
    
    ### DOCUMENTS FONT:
    """${safeContext}"""
    
    ### METADADES CONEGUDES:
    - Nom: "${baseMetadata.nom || 'Unknown'}"
    - Curs: "${baseMetadata.curs || ''}"
    - Diagnòstic: "${baseMetadata.diagnostic || ''}"

    ### ESTRUCTURA JSON OBJECTIU:
    ${jsonStructure}
    
    ### INSTRUCCIONS:
    ${roleInstructions}
    - **Idioma**: Català.
    - **Respon EXCLUSIVAMENT amb el codi JSON**.
    - Si una secció no té dades, deixa-la com a array buit [] o string buit "".
    - Sigues rigorós amb els termes NESE, DIL i els detalls de les mesures universals/intensives.
    `;

    // 3. CALL OLLAMA WITH TIMEOUT & DISPATCHER
    const { Agent } = require('undici');
    const agent = new Agent({
        connectTimeout: 60000,
        headersTimeout: 300000,
        bodyTimeout: 1800000
    });

    let lastError = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            console.log(`🚀 Sending Prompt to Ollama (Attempt ${attempt}/2, Model: ${MODEL_NAME})...`);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1800000);

            const response = await fetch(OLLAMA_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                dispatcher: agent,
                body: JSON.stringify({
                    model: MODEL_NAME,
                    prompt: prompt,
                    stream: false,
                    format: 'json',
                    keep_alive: "60m",
                    options: {
                        temperature: 0.1,
                        num_ctx: 8192,
                        num_predict: 2000
                    }
                }),
                signal: controller.signal
            });

            if (!response.ok) {
                const errorText = await response.text();
                clearTimeout(timeoutId);
                throw new Error(`Ollama Error (Status ${response.status}): ${errorText}`);
            }

            const data = await response.json();
            clearTimeout(timeoutId);
            console.log("✅ Response received. Parsing...");

            let parsedResult = handleJsonResponse(data.response);
            return finalizeMetadata(parsedResult, baseMetadata);

        } catch (error) {
            lastError = error;
            console.error(`⚠️ Attempt ${attempt} failed:`, error.message);
            if (error.name === 'AbortError' || error.code === 'UND_ERR_HEADERS_TIMEOUT' || error.message.includes('fetch failed')) {
                console.warn("🔄 Retrying...");
                continue;
            }
            throw error;
        }
    }
    throw lastError;
}

function handleJsonResponse(rawJson) {
    try {
        const cleanJson = rawJson.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanJson);
    } catch (e) {
        console.warn("⚠️ Standard JSON parse failed. Attempting repair...");
        try {
            const { jsonrepair } = require('jsonrepair');
            return JSON.parse(jsonrepair(rawJson));
        } catch (repairError) {
            console.error("❌ JSON Repair Failed. Raw output:", rawJson);
            throw new Error(`JSON Parse Error: ${e.message}`);
        }
    }
}

function finalizeMetadata(finalData, baseMetadata) {
    if (!finalData.perfil) finalData.perfil = {};
    if (baseMetadata.nom) finalData.perfil.nomCognoms = baseMetadata.nom;
    if (baseMetadata.curs) finalData.perfil.curs = baseMetadata.curs;
    if (baseMetadata.diagnostic && !finalData.diagnostic) finalData.diagnostic = baseMetadata.diagnostic;
    console.log("✅ Extraction Complete.");
    return finalData;
}

async function warmupModel() {
    try {
        console.log(`🔥 Warming up Ollama model (${MODEL_NAME})...`);
        await fetch(OLLAMA_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: MODEL_NAME,
                prompt: "hi",
                stream: false,
                keep_alive: "60m"
            })
        });
        console.log("✅ Model Warmed Up & Ready.");
    } catch (e) {
        console.error("⚠️ Model Warmup Failed:", e.message);
    }
}

module.exports = { extractPIdata, warmupModel };
