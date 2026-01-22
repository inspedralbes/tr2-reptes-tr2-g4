const path = require('path');
const { parseFile } = require('./smartParser');

// Use the internal container URL for Ollama
const OLLAMA_URL = 'http://ollama:11434/api/generate';
const MODEL_NAME = process.env.MODEL_NAME || 'llama3.2:1b'; // Switched to 1b for speed

async function extractPIdata(filePath, originalFileName) {
    console.log(`📂 extracting data from: ${originalFileName}`);

    // 1. USE SMART PARSER TO GET RAW TEXT & METADATA
    const parsedData = await parseFile(filePath, originalFileName);

    if (!parsedData) {
        throw new Error("Formato de archivo no soportado o archivo vacío.");
    }

    const { metadata, context } = parsedData;

    // 2. CONSTRUCT PROMPT
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

    // OPTIMIZATION: Truncate context to ~1000 chars (critical for slow CPUs)
    // 8000 chars took >5 mins to process, causing a timeout before the first word was generated.
    const safeContext = context.length > 1000 ? context.substring(0, 1000) + "... [TRUNCATED]" : context;

    const prompt = `
    You are an expert data extraction AI for Catalan educational documents (Individualized Plans).
    
    ### SOURCE CONTEXT:
    """${safeContext}"""
    
    ### METADATA KNOWN:
    - Name: "${metadata.nom || 'Unknown'}"
    - Date: "${metadata.data || ''}"
    - Course: "${metadata.curs || ''}"
    - Diagnostic: "${metadata.diagnostic || ''}"

    ### TARGET JSON STRUCTURE:
    ${jsonStructure}
    
    ### INSTRUCTIONS:
    1. Extract the student's **Full Name** and **Date of Birth** if not already in metadata.
    2. Extract the **Diagnostic/Reason** for the plan.
    3. **justificacio**: Extract the justification or reason for the Individualized Plan.
    4. **adaptacionsGenerals**: Extract a list of methodology adaptations, classroom measures, and support strategies. Look for sections like "Mesures", "Metodologia", "Adaptacions".
    5. **orientacions**: Extract family guidelines or agreements.
    6. **avaluacio**: Extract evaluation criteria or assessment methods.
    7. **IMPORTANT**: Output ONLY valid JSON.
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
                    num_ctx: 2048,
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
        if (metadata.nom) finalData.dadesAlumne.nomCognoms = metadata.nom;
        if (metadata.data) finalData.dadesAlumne.dataNaixement = metadata.data;
        if (metadata.curs) finalData.dadesAlumne.curs = metadata.curs;
        if (metadata.diagnostic && !finalData.motiu.diagnostic) {
            finalData.motiu.diagnostic = metadata.diagnostic;
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
