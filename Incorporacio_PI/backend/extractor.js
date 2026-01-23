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

    // -- COMMON FIELDS --
    // We use a superset structure so frontend often works, but we populate differently.

    if (role === 'orientador') {
        // ORIENTADOR: Quick Justificacio (after Diag), Extensive Adaptations
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
        // HISTORIAL: Global evolution across multiple years/documents
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
        // DOCENTE (Default): Classroom focus, Subjects, Evaluation
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

    // OPTIMIZATION: UNLIMITED Context for High-End PC
    const safeContext = aggregatedContext;

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

    // 3. CALL OLLAMA WITH TIMEOUT & KEEP_ALIVE (STREAMING MODE)
    try {
        console.log(`🚀 Sending Prompt to Ollama (${MODEL_NAME})...`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1800000); // 30 min timeout

        const response = await fetch(OLLAMA_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: MODEL_NAME,
                prompt: prompt,
                stream: false, // DISABLE STREAMING FOR STABILITY
                format: 'json',
                keep_alive: "60m",
                options: {
                    temperature: 0.1,
                    num_ctx: 8192,
                    num_predict: 1200
                }
            }),
            signal: controller.signal
        });

        if (!response.ok) {
            const errorText = await response.text();
            clearTimeout(timeoutId);
            throw new Error(`Ollama API Error contacting ${OLLAMA_URL} (Status ${response.status}): ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        const rawJson = data.response;
        clearTimeout(timeoutId);
        console.log("✅ Response received. Raw Length:", rawJson.length);


        // 4. ROBUST JSON PARSING
        let finalData;
        try {
            // Remove markdown code blocks if present
            const cleanJson = rawJson.replace(/```json/g, '').replace(/```/g, '').trim();
            finalData = JSON.parse(cleanJson);
        } catch (e) {
            console.warn("⚠️ Standard JSON parse failed. Attempting repair with jsonrepair...");
            try {
                // Require inside function to avoid startup error if not installed yet (though we just did)
                const { jsonrepair } = require('jsonrepair');
                const repaired = jsonrepair(rawJson);
                finalData = JSON.parse(repaired);
            } catch (repairError) {
                console.error("❌ JSON Repair Failed. Raw output:", rawJson);
                throw new Error(`JSON Parse Error: ${e.message} | Repair Error: ${repairError.message}`);
            }
        }

        // 5. MERGE METADATA (PRIORITY)
        // Adjust for new structure (which uses 'perfil' instead of 'dadesAlumne')
        if (!finalData.perfil) finalData.perfil = {};

        if (baseMetadata.nom) finalData.perfil.nomCognoms = baseMetadata.nom;
        if (baseMetadata.data) finalData.perfil.dataNaixement = baseMetadata.data;
        if (baseMetadata.curs) finalData.perfil.curs = baseMetadata.curs;

        // Handle Diagnostic
        if (baseMetadata.diagnostic && !finalData.diagnostic) {
            finalData.diagnostic = baseMetadata.diagnostic;
        }

        console.log("✅ Extraction Complete.");
        return finalData;

    } catch (error) {
        console.error(`❌ Error in extractPIdata (URL: ${OLLAMA_URL}):`, error.message);
        if (error.cause) console.error('🔍 Cause:', error.cause);
        throw error;
    }
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
        console.error("⚠️ Model Warmup Failed (Non-fatal):", e.message);
    }
}

module.exports = { extractPIdata, warmupModel };
