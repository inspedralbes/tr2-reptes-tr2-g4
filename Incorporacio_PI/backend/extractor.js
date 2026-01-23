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

    const maxRetries = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`🤖 [IA] Intent ${attempt}/${maxRetries} - Enviant a Ollama (${MODEL_NAME})`);
            console.log(`📊 [IA] Mida del context: ${aggregatedContext.length} caràcters`);

            // Usamos un simple AbortController para el timeout
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 600000); // 10 minutos

            const response = await fetch(OLLAMA_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: MODEL_NAME,
                    prompt: prompt,
                    stream: false,
                    format: 'json',
                    options: {
                        temperature: 0.1,
                        num_ctx: 8192,
                        num_predict: 800
                    }
                }),
                signal: controller.signal
            });

            clearTimeout(timeout);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Ollama Error ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            if (onProgress) onProgress("FINALITZANT...");

            let finalData;
            try {
                const clean = data.response.replace(/```json/g, '').replace(/```/g, '').trim();
                finalData = JSON.parse(clean);
            } catch (e) {
                console.warn("⚠️ [IA] Error parsejant JSON, intentant reparar...");
                const { jsonrepair } = require('jsonrepair');
                finalData = JSON.parse(jsonrepair(data.response));
            }

            if (!finalData.perfil) finalData.perfil = {};
            finalData.perfil.nomCognoms = "Alumne ANONIMITZAT";
            if (baseMetadata.curs) finalData.perfil.curs = baseMetadata.curs;
            if (baseMetadata.diagnostic && (role === 'docente' || role === 'orientador')) {
                finalData.diagnostic = baseMetadata.diagnostic;
            }

            console.log(`✅ [IA] Resum generat en intent ${attempt}.`);
            return finalData;

        } catch (e) {
            lastError = e;
            console.error(`⚠️ [IA] Intent ${attempt} fallat:`, e.name === 'AbortError' ? 'Timeout excedit' : e.message);
            if (attempt < maxRetries) {
                await new Promise(r => setTimeout(r, 2000));
            }
        }
    }

    console.error(`🔥 [IA] ERROR FINAL.`);
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
