const path = require('path');
const { parseFile } = require('./smartParser');

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://ollama:11434';
const OLLAMA_URL = `${OLLAMA_HOST}/api/generate`;
const MODEL_NAME = process.env.MODEL_NAME || 'llama3.2:3b';

async function extractPIdata(filesInput, role = 'docente') {
    const files = Array.isArray(filesInput) ? filesInput : [{ path: filesInput, name: 'document' }];
    console.log(`📂 Analysis started (Role: ${role})...`);

    let aggregatedContext = "";
    let baseMetadata = {};

    for (const file of files) {
        try {
            const parsedData = await parseFile(file.path, file.name);
            if (parsedData) {
                aggregatedContext += `\n[DOC: ${file.name}]\n${parsedData.context}\n`;
                if (parsedData.metadata.nom) baseMetadata.nom = parsedData.metadata.nom;
                if (parsedData.metadata.curs) baseMetadata.curs = parsedData.metadata.curs;
                if (parsedData.metadata.diagnostic) baseMetadata.diagnostic = parsedData.metadata.diagnostic;
            }
        } catch (e) { }
    }

    if (!aggregatedContext) throw new Error("ABORT_JOB: No content.");

    // BALANCED CONTEXT (18k characters covers the most important sections)
    const safeContext = aggregatedContext.length > 18000 ? aggregatedContext.substring(0, 18000) + "..." : aggregatedContext;

    const structures = {
        orientador: `{"perfil":{"nomCognoms":"","dataNaixement":"","curs":""},"diagnostic":"","justificacio":"","necessitats":[],"adaptacions":[],"orientacions":[]}`,
        historial: `{"evolució":"","puntsClauRecurrents":[],"adaptacionsConstants":[],"estatActual":""}`,
        docente: `{"perfil":{"nomCognoms":"","curs":""},"diagnostic":"","prioritats":[],"orientacioAula":[],"assignatures":[{"materia":"","continguts":"","avaluacio":""}],"criterisAvaluacioGeneral":[]}`
    };

    // PROFESSIONAL PROMPT
    const prompt = `Ets un expert en Plans Individualitzats (PI) a Catalunya. 
Analitza el document i extreu la informació seguint exactament l'estructura JSON proporcionada.

### INSTRUCCIONS CRÍTIQUES:
1. **Assignatures**: Llista totes les matèries trobades. Per a cada una, descriu l'adaptació aplicada i els criteris d'avaluació. No les deixis buides.
2. **Prioritats i Orientacions**: Explica de forma clara què s'ha de fer a l'aula.
3. **Idioma**: Respon sempre en Català.
4. **Format**: Respon EXCLUSIVAMENT amb el codi JSON, sense text introductori.

### ESTRUCTURA OBJECTIU:
${structures[role] || structures.docente}

### TEXT DEL DOCUMENT:
"""${safeContext}"""`;

    const { Agent } = require('undici');
    const agent = new Agent({
        connectTimeout: 60000,
        headersTimeout: 600000, // 10 min
        bodyTimeout: 1200000    // 20 min
    });

    try {
        console.log(`🚀 AI Starting Analysis (Context: ${safeContext.length} chars)...`);
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
                    num_ctx: 8192, // High context for better quality
                    num_predict: 1500 // Allow enough space for detailed subject lists
                }
            })
        });

        if (!response.ok) throw new Error(`Ollama Error ${response.status}`);
        const data = await response.json();

        let finalData;
        try {
            const cleanJson = data.response.replace(/```json/g, '').replace(/```/g, '').trim();
            finalData = JSON.parse(cleanJson);
        } catch (e) {
            const { jsonrepair } = require('jsonrepair');
            finalData = JSON.parse(jsonrepair(data.response));
        }

        // Metadata Injection (Protect original data)
        if (!finalData.perfil) finalData.perfil = {};
        if (baseMetadata.nom) finalData.perfil.nomCognoms = baseMetadata.nom;
        if (baseMetadata.curs) finalData.perfil.curs = baseMetadata.curs;
        if (baseMetadata.diagnostic && !finalData.diagnostic) finalData.diagnostic = baseMetadata.diagnostic;

        console.log("✅ AI Summary Complete and formatted.");
        return finalData;
    } catch (error) {
        console.error("❌ AI Error during generation:", error.message);
        throw error;
    }
}

async function warmupModel() {
    try {
        await fetch(OLLAMA_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: MODEL_NAME, prompt: "hi", stream: false, keep_alive: "60m" })
        });
    } catch (e) { }
}

module.exports = { extractPIdata, warmupModel };
