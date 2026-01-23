const path = require('path');
const { parseFile } = require('./smartParser');

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://ollama:11434';
const OLLAMA_URL = `${OLLAMA_HOST}/api/generate`;
const MODEL_NAME = process.env.MODEL_NAME || 'llama3.2:3b';

async function extractPIdata(filesInput, role = 'docente', onProgress = null, directText = null) {
    let aggregatedContext = directText || "";
    let baseMetadata = { nom: "Alumne ANONIMITZAT", curs: null, diagnostic: null };

    if (!directText) {
        const files = Array.isArray(filesInput) ? filesInput : [{ path: filesInput, name: 'document' }];
        if (onProgress) onProgress("LLEGINT ARXIUS...");

        for (const file of files) {
            const parsedData = await parseFile(file.path, file.name);
            if (parsedData) {
                aggregatedContext += `\n--- DOC: ${file.name} ---\n${parsedData.context}\n`;
                if (parsedData.metadata.curs) baseMetadata.curs = parsedData.metadata.curs;
                if (parsedData.metadata.diagnostic) baseMetadata.diagnostic = parsedData.metadata.diagnostic;
            }
        }
    }

    if (!aggregatedContext) throw new Error("ABORT_ANALISI: No content.");
    if (onProgress) onProgress("GENERANT RESUM...");

    const structures = {
        orientador: `{"perfil":{"curs":""},"diagnostic":"","necessitats":[],"adaptacions":[],"orientacions":[]}`,
        historial: `{"evolució":"","puntsClauRecurrents":[],"adaptacionsConstants":[],"estatActual":""}`,
        docente: `{"perfil":{"curs":""},"diagnostic":"","prioritats":[],"orientacioAula":[],"assignatures":[{"materia":"","continguts":"","avaluacio":""}],"criterisAvaluacioGeneral":[]}`
    };

    const prompt = `Ets un motor d'IA ultra-ràpid. Genera el JSON pedagògic.
ANONIMITZAT: NO incloguis noms.

### DADES:
"""${aggregatedContext}"""

### METADATA:
- Curs: "${baseMetadata.curs || 'N/D'}"
- Diagnòstic: "${baseMetadata.diagnostic || 'N/D'}"

### JSON:
${structures[role] || structures.docente}

### REGLA: Respon NOMÉS amb el JSON. Sigues directe.`;

    const maxRetries = 2;
    let lastError = null;

    // AUMENTAMOS CONTEXTO: 12.000 carácteres para capturar todo el documento
    const fullContext = aggregatedContext.substring(0, 12000);

    const finalPrompt = `Ets un expert en orientació pedagògica. 
Analitza el document PI i genera un SUMMARY DETALLAT. 
Extreu TOTES les adaptacions d'aula i les de cada assignatura (materia, continguts i avaluació). 
És vital que NO et deixis detalls tècnics.

### CONTEXT DEL DOCUMENT:
"""
${fullContext}
"""

### ESTRUCTURA JSON REQUERIDA:
${structures[role] || structures.docente}

REGLA DE FORMAT: RESPON NOMÉS AMB UN OBJECTE JSON. SIGUES EXTENS I DETALLAT.`;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`🤖 [IA] Intent ${attempt}/${maxRetries} - Ollama (${MODEL_NAME})`);
            console.log(`📊 [IA] Mida del context enviat: ${fullContext.length} caràcters`);

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 300000);

            const response = await fetch(OLLAMA_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: MODEL_NAME,
                    prompt: finalPrompt,
                    stream: false,
                    format: 'json',
                    options: {
                        temperature: 0.1,
                        num_ctx: 8192,
                        num_predict: 1000
                    }
                }),
                signal: controller.signal
            });

            clearTimeout(timeout);
            if (!response.ok) throw new Error(`Ollama Error ${response.status}`);

            const data = await response.json();
            if (onProgress) onProgress("FINALITZANT...");

            let finalData;
            try {
                const clean = data.response.replace(/```json/g, '').replace(/```/g, '').trim();
                finalData = JSON.parse(clean);
            } catch (e) {
                const { jsonrepair } = require('jsonrepair');
                finalData = JSON.parse(jsonrepair(data.response));
            }

            // Mínimos de seguridad para el frontend
            if (!finalData.perfil) finalData.perfil = {};
            finalData.perfil.nomCognoms = "Alumne ANONIMITZAT";
            if (baseMetadata.curs && !finalData.perfil.curs) finalData.perfil.curs = baseMetadata.curs;
            if (baseMetadata.diagnostic && !finalData.diagnostic) finalData.diagnostic = baseMetadata.diagnostic;

            console.log(`✅ [IA] Resum ric generat OK.`);
            return finalData;

        } catch (e) {
            lastError = e;
            console.error(`⚠️ [IA] Intent ${attempt} fallat:`, e.message);
            if (attempt < maxRetries) await new Promise(r => setTimeout(r, 2000));
        }
    }
    throw lastError;
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
