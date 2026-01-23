const path = require('path');
const { parseFile } = require('./smartParser');

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://ollama:11434';
const OLLAMA_URL = `${OLLAMA_HOST}/api/generate`;
const MODEL_NAME = process.env.MODEL_NAME || 'llama3.2:3b';

async function extractPIdata(filesInput, role = 'docente') {
    const files = Array.isArray(filesInput) ? filesInput : [{ path: filesInput, name: 'document' }];
    console.log(`📂 FAST ANALYSIS (Role: ${role})...`);

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

    // BALANCED CONTEXT LIMIT (18k chars ~ approx 7-10 pages of relevant text)
    const safeContext = aggregatedContext.length > 18000 ? aggregatedContext.substring(0, 18000) + "..." : aggregatedContext;

    const structures = {
        orientador: `{"perfil":{"nomCognoms":"","dataNaixement":"","curs":""},"diagnostic":"","justificacio":"","necessitats":[],"adaptacions":[],"orientacions":[]}`,
        historial: `{"evolució":"","puntsClauRecurrents":[],"adaptacionsConstants":[],"estatActual":""}`,
        docente: `{"perfil":{"nomCognoms":"","curs":""},"diagnostic":"","prioritats":[],"orientacioAula":[],"assignatures":[{"materia":"","continguts":"","avaluacio":""}],"criterisAvaluacioGeneral":[]}`
    };

    const prompt = `Analitza el PI i genera un JSON en Català.
Text: """${safeContext}"""
Estructura: ${structures[role] || structures.docente}
Instruccions: Sigues molt breu. Respon NOMÉS amb el JSON.`;

    const { Agent } = require('undici');
    const agent = new Agent({
        connectTimeout: 60000,
        headersTimeout: 600000, // 10 min for headers
        bodyTimeout: 1200000    // 20 min for full body
    });

    try {
        console.log(`🚀 AI Process started (Length: ${safeContext.length} chars)...`);
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
                    num_ctx: 4096,
                    num_predict: 1000
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

        // Metadata Injection
        if (!finalData.perfil) finalData.perfil = {};
        if (baseMetadata.nom) finalData.perfil.nomCognoms = baseMetadata.nom;
        if (baseMetadata.curs) finalData.perfil.curs = baseMetadata.curs;
        if (baseMetadata.diagnostic && !finalData.diagnostic) finalData.diagnostic = baseMetadata.diagnostic;

        console.log("✅ AI Processed successfully.");
        return finalData;
    } catch (error) {
        console.error("❌ AI Error:", error.message);
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
