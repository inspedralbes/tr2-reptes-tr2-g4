const path = require('path');
const { parseFile } = require('./smartParser');

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://ollama:11434';
const OLLAMA_URL = `${OLLAMA_HOST}/api/generate`;
const MODEL_NAME = process.env.MODEL_NAME || 'llama3.2:3b';

async function extractPIdata(filesInput, role = 'docente') {
    const files = Array.isArray(filesInput) ? filesInput : [{ path: filesInput, name: 'document' }];
    console.log(`🚀 STARTING SMART EXTRACTION (Role: ${role})...`);

    let aggregatedContext = "";
    let baseMetadata = {};

    for (const file of files) {
        const parsedData = await parseFile(file.path, file.name);
        if (parsedData) {
            aggregatedContext += `\n--- CONTINGUT DE: ${file.name} ---\n${parsedData.context}\n`;
            if (parsedData.metadata.nom) baseMetadata.nom = parsedData.metadata.nom;
            if (parsedData.metadata.curs) baseMetadata.curs = parsedData.metadata.curs;
            if (parsedData.metadata.diagnostic) baseMetadata.diagnostic = parsedData.metadata.diagnostic;
        }
    }

    if (!aggregatedContext) throw new Error("ABORT_JOB: No usable content.");

    const structures = {
        orientador: `{"perfil":{"nomCognoms":"","curs":""},"diagnostic":"","necessitats":[],"adaptacions":[],"orientacions":[]}`,
        historial: `{"evolució":"","puntsClauRecurrents":[],"adaptacionsConstants":[],"estatActual":""}`,
        docente: `{"perfil":{"nomCognoms":"","curs":""},"diagnostic":"","prioritats":[],"orientacioAula":[],"assignatures":[{"materia":"","continguts":"","avaluacio":""}],"criterisAvaluacioGeneral":[]}`
    };

    const prompt = `Ets un motor d'IA per a resums de PI. 
Analitza el text resumit i omple el JSON següent.

### DADOS RECOLLITS:
"""${aggregatedContext}"""

### ESTRUCTURA OBJECTIU:
${structures[role] || structures.docente}

### INSTRUCCIONS:
1. **Assignatures**: Si veus línies que comencen per "✅ SELECCIONAT", aquestes són les adaptacions reals. Agrupa-les per matèria.
2. **Orientacions**: Si veus "💡 ORIENTACIÓ", inclou-ho a l'apartat corresponent.
3. El nom de l'alumne és: "${baseMetadata.nom || 'Desconegut'}".
4. Sigues breu i professional. Respon NOMÉS amb el JSON.`;

    const { Agent } = require('undici');
    const agent = new Agent({ connectTimeout: 60000, headersTimeout: 300000, bodyTimeout: 600000 });

    try {
        console.log(`📤 Sending Smart Context to AI (Length: ${aggregatedContext.length} chars)...`);
        const response = await fetch(OLLAMA_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            dispatcher: agent,
            body: JSON.stringify({
                model: MODEL_NAME,
                prompt: prompt,
                stream: false,
                format: 'json',
                options: { temperature: 0.1, num_ctx: 4096, num_predict: 1000 }
            })
        });

        if (!response.ok) throw new Error(`Status ${response.status}`);
        const data = await response.json();

        // Parse with repair support
        let finalData;
        try {
            const clean = data.response.replace(/```json/g, '').replace(/```/g, '').trim();
            finalData = JSON.parse(clean);
        } catch (e) {
            const { jsonrepair } = require('jsonrepair');
            finalData = JSON.parse(jsonrepair(data.response));
        }

        // Hard-set Metadata
        if (!finalData.perfil) finalData.perfil = {};
        finalData.perfil.nomCognoms = baseMetadata.nom || finalData.perfil.nomCognoms;
        finalData.perfil.curs = baseMetadata.curs || finalData.perfil.curs;
        if (baseMetadata.diagnostic && !finalData.diagnostic) finalData.diagnostic = baseMetadata.diagnostic;

        console.log("✅ Smart extraction complete.");
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
