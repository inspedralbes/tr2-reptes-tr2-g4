const path = require('path');
const { parseFile } = require('./smartParser');

// Use the internal container URL for Ollama
const OLLAMA_URL = 'http://ollama:11434/api/generate';
const MODEL_NAME = process.env.MODEL_NAME || 'llama3.2:3b'; // Switched to 3b for PC

async function extractPIdata(filesInput) {
    // Normalize input: allow single file (legacy) or array
    const files = Array.isArray(filesInput) ? filesInput : [{ path: filesInput, name: arguments[1] || 'Unknown' }];

    console.log(`📂 extracting data from ${files.length} sources...`);

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
        throw new Error("No extracted text available from any file.");
    }

    // 2. CONSTRUCT PROMPT (MULTI-JOB AWARE)
    const jsonStructure = `{
      "dadesAlumne": {
        "nomCognoms": "",
        "dataNaixement": "",
        "curs": ""
      },
      "motiu": {
        "diagnostic": ""
      },
      "justificacio": [], 
      "adaptacionsGenerals": [],
      "orientacions": [], 
      "avaluacio": []
    }`;

    // OPTIMIZATION: UNLIMITED Context for High-End PC
    // We are passing the full text. If it exceeds the model's context window, Ollama might truncate it internally 
    // or we might need a sliding window approach in the future, but for now: NO LIMITS.
    const safeContext = aggregatedContext;

    const prompt = `
    You are an expert data extraction AI for Catalan educational documents (Individualized Plans).
    You have been provided with one or more documents for the same student.
    
    ### SOURCE DOCUMENTS (Chronological Order):
    """${safeContext}"""
    
    ### METADATA KNOWN (From latest doc):
    - Name: "${baseMetadata.nom || 'Unknown'}"
    - Course: "${baseMetadata.curs || ''}"
    - Diagnostic: "${baseMetadata.diagnostic || ''}"

    ### TARGET JSON STRUCTURE:
    ${jsonStructure}
    
    ### INSTRUCTIONS:
    1. **GENERAL**: Extract the most current student data.
    2. **justificacio**: THIS IS UNIQUE. Look at different documents. If you see an evolution (e.g., "In 2023 he had X, in 2024 he improved"), SUMMARIZE THE HISTORY. Explicitly mention dates if available.
    3. **motiu.diagnostic**: Use the most recent diagnosis found.
    4. **adaptacionsGenerals**: Merge unique adaptations from all documents. Focus on what is currently applied.
    5. **orientacions**: Merge recommendations.
    6. **avaluacio**: Extract evaluation criteria.
    7. **Output ONLY valid JSON**.
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
                stream: true, // ENABLE STREAMING
                format: 'json',
                keep_alive: "60m",
                options: {
                    temperature: 0.1,
                    num_ctx: 8192,
                    num_predict: 600
                }
            }),
            signal: controller.signal
        });

        if (!response.ok) {
            clearTimeout(timeoutId);
            throw new Error(`Ollama API Error: ${response.statusText}`);
        }

        // 3.1 CONSUME STREAM
        let rawJson = "";
        // reader removed to avoid locking stream checking

        if (response.body[Symbol.asyncIterator]) {
            // Node 18+ style
            const decoder = new TextDecoder();
            for await (const chunk of response.body) {
                const parts = decoder.decode(chunk, { stream: true }).split('\n');
                for (const part of parts) {
                    if (!part.trim()) continue;
                    try {
                        const jsonPart = JSON.parse(part);
                        if (jsonPart.response) rawJson += jsonPart.response;
                    } catch (e) {
                        // ignore incomplete chunks
                    }
                }
            }
        } else {
            // Fallback (older node? shouldn't happen in container)
            clearTimeout(timeoutId);
            throw new Error("Streaming not supported in this environment");
        }

        clearTimeout(timeoutId);
        console.log("✅ Streaming Complete. Raw Length:", rawJson.length);

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
        if (baseMetadata.nom) finalData.dadesAlumne.nomCognoms = baseMetadata.nom;
        if (baseMetadata.data) finalData.dadesAlumne.dataNaixement = baseMetadata.data;
        if (baseMetadata.curs) finalData.dadesAlumne.curs = baseMetadata.curs;
        if (baseMetadata.diagnostic && !finalData.motiu.diagnostic) {
            finalData.motiu.diagnostic = baseMetadata.diagnostic;
        }

        console.log("✅ Extraction Complete.");
        return finalData;

    } catch (error) {
        console.error('❌ Error in extractPIdata:', error.message);
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
