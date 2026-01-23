const path = require('path');
const { parseFile } = require('./smartParser');

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://ollama:11434';
const OLLAMA_URL = `${OLLAMA_HOST}/api/generate`;
const MODEL_NAME = process.env.MODEL_NAME || 'llama3.2:3b';

async function extractPIdata(filesInput, role = 'docente') {
    const files = Array.isArray(filesInput) ? filesInput : [{ path: filesInput, name: arguments[1] || 'Unknown' }];
    console.log(`📂 Processing ${files.length} files (Role: ${role})...`);

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

    let jsonStructure = "";
    if (role === 'orientador') {
        jsonStructure = `{"perfil":{"nomCognoms":"","dataNaixement":"","curs":""},"diagnostic":"","justificacio":"","necessitats":[],"adaptacions":[],"orientacions":[]}`;
    } else if (role === 'historial') {
        jsonStructure = `{"evolució":"","puntsClauRecurrents":[],"adaptacionsConstants":[],"estatActual":""}`;
    } else {
        jsonStructure = `{"perfil":{"nomCognoms":"","curs":""},"diagnostic":"","prioritats":[],"orientacioAula":[],"assignatures":[{"materia":"","continguts":"","avaluacio":""}]}`;
    }

    // Context limit: 12k chars for speed (approx 3k tokens)
    const safeContext = aggregatedContext.length > 12000 ? aggregatedContext.substring(0, 12000) + "..." : aggregatedContext;

    const prompt = `Ets un expert en PIs. Genera JSON en Català.
Font: """${safeContext}"""
JSON: ${jsonStructure}
Instruccions: Sigues breu. NOMÉS el JSON.`;

    const { Agent } = require('undici');
    const agent = new Agent({
        connectTimeout: 30000,
        headersTimeout: 300000, // 5 min
        bodyTimeout: 600000     // 10 min
    });

    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            console.log(`🚀 AI Attempt ${attempt}/2 (Ctx: ${safeContext.length} chars)...`);
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
                    options: { temperature: 0.1, num_ctx: 4096, num_predict: 800 }
                })
            });

            if (!response.ok) throw new Error(`Ollama Error ${response.status}`);
            const data = await response.json();

            let finalData = handleJsonResponse(data.response);

            if (!finalData.perfil) finalData.perfil = {};
            if (baseMetadata.nom) finalData.perfil.nomCognoms = baseMetadata.nom;
            if (baseMetadata.curs) finalData.perfil.curs = baseMetadata.curs;
            if (baseMetadata.diagnostic && !finalData.diagnostic) finalData.diagnostic = baseMetadata.diagnostic;

            console.log("✅ AI Processed OK.");
            return finalData;
        } catch (error) {
            console.error(`⚠️ Attempt ${attempt} failed:`, error.message);
            if (attempt < 2) {
                await new Promise(r => setTimeout(r, 2000));
                continue;
            }
            throw error;
        }
    }
}

function handleJsonResponse(rawJson) {
    try {
        const cleanJson = rawJson.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanJson);
    } catch (e) {
        try {
            const { jsonrepair } = require('jsonrepair');
            return JSON.parse(jsonrepair(rawJson));
        } catch (err) {
            throw new Error("JSON Parse Error");
        }
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
