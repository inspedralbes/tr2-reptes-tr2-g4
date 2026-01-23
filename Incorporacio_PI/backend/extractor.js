const path = require('path');
const { parseFile } = require('./smartParser');

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://ollama:11434';
const OLLAMA_URL = `${OLLAMA_HOST}/api/generate`;
const MODEL_NAME = process.env.MODEL_NAME || 'llama3.2:3b';

async function extractPIdata(filesInput, role = 'docente') {
    const files = Array.isArray(filesInput) ? filesInput : [{ path: filesInput, name: arguments[1] || 'Unknown' }];
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

    let jsonStructure = "";
    let specificTask = "";

    if (role === 'orientador') {
        jsonStructure = `{
            "perfil": { "nomCognoms": "", "dataNaixement": "", "curs": "" },
            "diagnostic": "",
            "justificacio": "",
            "necessitats": [],
            "adaptacions": [], 
            "orientacions": []
        }`;
        specificTask = "Extreu dades personals, el diagnòstic tècnic, una justificació molt breu del PI i llista totes les barreres (necessitats) i mesures generals (adaptacions).";
    } else if (role === 'historial') {
        jsonStructure = `{
            "evolució": "",
            "puntsClauRecurrents": [],
            "adaptacionsConstants": [],
            "estatActual": ""
        }`;
        specificTask = "Compara els documents per resumir com ha evolucionat l'alumne, quins problemes es repeteixen sempre i quina és la situació actual.";
    } else {
        // DOCENTE
        jsonStructure = `{
            "perfil": { "nomCognoms": "", "curs": "" },
            "diagnostic": "",
            "prioritats": [],
            "orientacioAula": [], 
            "assignatures": [
                { "materia": "", "continguts": "", "avaluacio": "" }
            ],
            "criterisAvaluacioGeneral": []
        }`;
        specificTask = "Prioritza la informació útil per al dia a dia a l'aula. Extreu prioritats immediates, consells pràctics (orientació aula), el detall d'adaptacions per cada matèria i els criteris d'avaluació generals.";
    }

    // Context limit: 20k chars (Reasonable for quality on an 8-core machine)
    const safeContext = aggregatedContext.length > 20000 ? aggregatedContext.substring(0, 20000) + "..." : aggregatedContext;

    const prompt = `
    Ets un expert en Plans Individualitzats (PI) a Catalunya. 
    Analitza el següent text i genera un objecte JSON en Català.

    ### TEXT FONT:
    """${safeContext}"""
    
    ### INSTRUCCIONS:
    1. **Estructura**: Omple exclusivament aquest format: ${jsonStructure}
    2. **Tasques**: ${specificTask}
    3. **Rigor**: Sigues precís amb les adaptacions de les matèries. Si no hi ha dades per a una secció, deixa-la com a array buit [] o text buit "".
    4. **Format**: Respon NOMÉS amb el JSON vàlid. No afegeixis cap text explicatiu abans ni després.
    `;

    const { Agent } = require('undici');
    const agent = new Agent({
        connectTimeout: 60000,
        headersTimeout: 300000,
        bodyTimeout: 600000
    });

    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            console.log(`🚀 AI Attempt ${attempt}/2 (Context: ${safeContext.length} chars)...`);
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
                })
            });

            if (!response.ok) throw new Error(`Ollama Error ${response.status}`);
            const data = await response.json();

            let finalData = handleJsonResponse(data.response);

            // Final Meta Injection
            if (!finalData.perfil) finalData.perfil = {};
            if (baseMetadata.nom) finalData.perfil.nomCognoms = baseMetadata.nom;
            if (baseMetadata.curs) finalData.perfil.curs = baseMetadata.curs;
            if (baseMetadata.diagnostic && !finalData.diagnostic) finalData.diagnostic = baseMetadata.diagnostic;

            console.log("✅ AI Summary Complete.");
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
            console.error("Critical JSON Parse Error. Raw:", rawJson);
            throw new Error("ERROR_JSON_FORMAT");
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
