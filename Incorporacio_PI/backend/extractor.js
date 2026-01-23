const path = require('path');
const { parseFile } = require('./smartParser');

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://ollama:11434';
const OLLAMA_URL = `${OLLAMA_HOST}/api/generate`;
const MODEL_NAME = process.env.MODEL_NAME || 'llama3.2:3b';

async function extractPIdata(filesInput, role = 'docente') {
    const files = Array.isArray(filesInput) ? filesInput : [{ path: filesInput, name: 'document' }];
    console.log(`🚀 STARTING ANONYMOUS EXTRACTION (Role: ${role})...`);

    let aggregatedContext = "";
    let baseMetadata = { nom: "Alumne ANONIMITZAT", curs: null, diagnostic: null };

    for (const file of files) {
        const parsedData = await parseFile(file.path, file.name);
        if (parsedData) {
            aggregatedContext += `\n--- CONTINGUT DEO: ${file.name} ---\n${parsedData.context}\n`;
            if (parsedData.metadata.curs) baseMetadata.curs = parsedData.metadata.curs;
            if (parsedData.metadata.diagnostic) baseMetadata.diagnostic = parsedData.metadata.diagnostic;
        }
    }

    if (!aggregatedContext) throw new Error("ABORT_JOB: No usable content.");

    // Estructuras sin campo de nombre (nomCognoms)
    const structures = {
        orientador: `{"perfil":{"curs":""},"diagnostic":"","necessitats":[],"adaptacions":[],"orientacions":[]}`,
        historial: `{"evolució":"","puntsClauRecurrents":[],"adaptacionsConstants":[],"estatActual":""}`,
        docente: `{"perfil":{"curs":""},"diagnostic":"","prioritats":[],"orientacioAula":[],"assignatures":[{"materia":"","continguts":"","avaluacio":""}],"criterisAvaluacioGeneral":[]}`
    };

    const prompt = `Ets un motor d'IA professional. Omple el JSON estrictament amb les dades pedagògiques.
AVÍS: NO busquis ni incloguis el NOM de l'alumne. L'expedient és ANONIMITZAT.

### TEXT RECOLLIT:
"""${aggregatedContext}"""

### METADATA:
- Curs: "${baseMetadata.curs || 'N/D'}"
- Diagnòstic: "${baseMetadata.diagnostic || 'N/D'}"

### JSON OBJECTIU:
${structures[role] || structures.docente}

### INSTRUCCIONS:
1. Omple el JSON amb la informació pedagògica.
2. Usa estrictament la estructura proporcionada (no incloguis camps de noms).
3. Respon NOMÉS amb el JSON.`;

    const { Agent } = require('undici');
    const agent = new Agent({ connectTimeout: 60000, headersTimeout: 300000, bodyTimeout: 600000 });

    try {
        const response = await fetch(OLLAMA_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            dispatcher: agent,
            body: JSON.stringify({
                model: MODEL_NAME,
                prompt: prompt,
                stream: false,
                format: 'json',
                options: { temperature: 0.1, num_ctx: 8192, num_predict: 1500 }
            })
        });

        if (!response.ok) throw new Error(`Status ${response.status}`);
        const data = await response.json();

        let finalData;
        try {
            const clean = data.response.replace(/```json/g, '').replace(/```/g, '').trim();
            finalData = JSON.parse(clean);
        } catch (e) {
            const { jsonrepair } = require('jsonrepair');
            finalData = JSON.parse(jsonrepair(data.response));
        }

        // --- SOBREESCRIPTURA FINAL (FORZAR ANONIMATO) ---
        if (!finalData.perfil) finalData.perfil = {};
        finalData.perfil.nomCognoms = "Alumne ANONIMITZAT"; // Por si el frontend lo busca
        if (baseMetadata.curs) finalData.perfil.curs = baseMetadata.curs;
        if (baseMetadata.diagnostic && (role === 'docente' || role === 'orientador')) {
            finalData.diagnostic = baseMetadata.diagnostic;
        }

        console.log("✅ Anonymous extraction complete.");
        return finalData;
    } catch (e) {
        console.error("❌ Extraction Error:", e.message);
        throw e;
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
