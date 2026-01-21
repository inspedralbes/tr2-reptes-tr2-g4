const OpenAI = require("openai");

// Configuració del client per a OLLAMA
const openai = new OpenAI({
    baseURL: "http://pi_llm:11434/v1", // Port d'Ollama
    apiKey: "ollama",  // Ollama requereix una string qualsevol
    timeout: 60 * 60 * 1000, // 1 hora timeout
});

const MODEL_NAME = "pimodel"; // Nom intern que donarem al teu model dins d'Ollama

const fs = require('fs');
const path = require('path');

/**
 * Funció robusta per inicialitzar la IA.
 * Manté el contenidor viu (no crash) mentre intenta connectar i configurar Ollama.
 */
async function initializeAI() {
    const modelFileName = "Llama-3.2-3B-Instruct-Q4_K_M.gguf";
    // PATHS:
    // internalPath: On ho veiem nosaltres (Backend Node)
    // ollamaPath: On ho veu Ollama (Volum Docker muntat a /models)
    const internalPath = `/app/models/${modelFileName}`;
    const ollamaPath = `/models/${modelFileName}`;
    const ollamaHost = "http://pi_llm:11434";

    console.log("🚀 [aiService] INICIANT SISTEMA D'INTEL·LIGÈNCIA ARTIFICIAL...");

    // 1. VERIFICACIÓ DE FITXER
    if (!fs.existsSync(internalPath)) {
        console.error(`❌ [aiService] ERROR FATAL: No es troba el fitxer .gguf a: ${internalPath}`);
        console.error("   Assegura't que l'has posat a tr2-reptes-tr2-g4/Incorporacio_PI/backend/models/");
        // En aquest cas no podem fer res, però no fem crash del tot per deixar el servidor web actiu (upload files)
        return false;
    }

    // BUCLE INFINIT DE CONNEXIÓ (El que demana l'usuari: "que no reinicie, que ho intenti")
    while (true) {
        try {
            // A. PING OLLAMA
            // Intentem veure si Ollama està despert
            try {
                const health = await fetch(`${ollamaHost}/api/tags`);
                if (!health.ok) throw new Error(`Ollama status ${health.status}`);
            } catch (netErr) {
                console.warn("⏳ [aiService] Esperant a Ollama (pi_llm)...");
                await new Promise(r => setTimeout(r, 3000));
                continue; // Tornem a l'inici del bucle
            }

            console.log("✅ [aiService] Ollama connectat!");

            // NOU: Verificar versió per debug
            try {
                const verRes = await fetch(`${ollamaHost}/api/version`);
                const verData = await verRes.json();
                console.log(`ℹ️ [aiService] Versió Ollama: ${verData.version}`);
            } catch (ignore) { }

            // B. CHECK/CREATE MODEL
            // Comprovem si el model ja existeix
            const tagsRes = await fetch(`${ollamaHost}/api/tags`);
            const tagsData = await tagsRes.json();
            const exists = tagsData.models?.some(m => m.name === MODEL_NAME || m.name === `${MODEL_NAME}:latest`);

            if (exists) {
                console.log(`✅ [aiService] El model '${MODEL_NAME}' JA ESTÀ CARREGAT.`);
                break; // Sortim del bucle, tot correcte!
            }

            // Si no existeix, el creem
            console.log(`⚙️ [aiService] EL MODEL NO EXISTEIX. CREANT-LO ARA...`);
            console.log(`   -> Font: ${ollamaPath}`);
            console.log("   -> Això pot trigar uns minuts (llegint 2GB+)... NO APAGUIS.");

            // PROVEM AMB 'from' DIRECTAMENT (Segons error "neither from or files specified")
            const payload = {
                name: MODEL_NAME,
                modelfile: `FROM ${ollamaPath}`, // Mantenim per si de cas
                from: ollamaPath,                // AFEGIT: La clau que demana error
                stream: false
            };

            console.log("   -> Payload:", JSON.stringify(payload));

            const createRes = await fetch(`${ollamaHost}/api/create`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!createRes.ok) {
                const errText = await createRes.text();
                console.error(`⚠️ [aiService] Error creant model (${createRes.status}): ${errText}`);
                console.log("   -> Reintentant en 5 segons...");
                await new Promise(r => setTimeout(r, 5000));
                continue;
            }

            console.log(`🎉 [aiService] MODEL '${MODEL_NAME}' CREAT AMB ÈXIT!`);
            break; // Èxit total

        } catch (error) {
            console.error(`❌ [aiService] Error inesperat en la inicialització: ${error.message}`);
            await new Promise(r => setTimeout(r, 5000));
        }
    }

    // C. WARM UP (Opcional)
    console.log("🔥 [aiService] Escalfant motor d'inferència...");
    try {
        await openai.chat.completions.create({
            model: MODEL_NAME,
            messages: [{ role: "user", content: "hi" }],
            max_tokens: 1
        });
        console.log("🟢 [aiService] SISTEMA LLEST I OPERATIU.");
    } catch (e) {
        console.warn("⚠️ [aiService] Warm-up sense resposta (normal si està carregant lazy): " + e.message);
    }

    return true;
}

// Mantenim compatibilitat amb server.js
const checkConnection = initializeAI;


/**
 * Genera un resum utilitzant IA LOCAL (sense streaming HTTP directe).
 * Retorna el text complet quan acaba.
 * @param {string} role - 'docent' o 'orientador'
 * @param {function} onProgress - Callback opcional (textParcial, percentatge)
 */
async function generateSummaryLocal(text, role, onProgress) {

    // OPTIMITZACIÓ EXTREMA: Neteja de "soroll"
    let cleanText = text
        .replace(/Copèrnic, 84 08006 Barcelona/g, '')
        .replace(/telèfon: 93 200 49 13/g, '')
        .replace(/fax: 93 414 04 34/g, '')
        .replace(/institutmontserrat@xtec.cat/g, '')
        .replace(/www.institutmontserrat.cat/g, '')
        .replace(/Pla individualitzat: xxxx xxx xxx/g, '')
        .replace(/Sí No/g, '') // Eliminar capçaleres de taula
        .replace(/Adaptacions que es proposen/g, '')
        .replace(/\n\s*\n/g, '\n');

    const limit = role === 'global' ? 6000 : 3500;
    const MAX_CHARS = limit;
    const truncatedText = cleanText.length > MAX_CHARS ? cleanText.substring(0, MAX_CHARS) + "..." : cleanText;

    let systemPrompt = "Ets un expert en educació. La teva tasca és extreure informació i formatar-la.";
    let userPrompt = "";

    if (role === 'orientador') {
        userPrompt = `Analitza el següent text d'un Pla Individualitzat (PI) i genera un resum estructurat.
        
        <TEXT_PI>
        ${truncatedText}
        </TEXT_PI>

        INSTRUCCIONS DE FORMAT (SEGUEIX-LES AL PEU DE LA LLETRA):
        
        Vull que generis EXACTAMENT aquestes 5 seccions. No inventis res. Si no trobes informació, digues "No especificat".

        1. PERFIL DE L'ALUMNE
        (Escriu un paràgraf breu de 2-3 línies sobre el curs i problemes generals. NO facis llistes.)

        2. DIAGNÒSTIC
        (Escriu un paràgraf breu de 2-3 línies amb el diagnòstic concret. NO facis llistes.)

        3. JUSTIFICACIÓ DEL PI
        (Breu explicació textual.)

        4. ORIENTACIÓ A L'AULA
        (Fes una llista amb guions '-' de pautes per al professor. Elimina les 'X' finals.)

        5. MATÈRIES
        (Si veus matèries específiques com Mates/Català amb 'X', llista-les: "- Matèria: Adaptació". Si només hi ha adaptacions generals, escriu un paràgraf explicatiu.)

        IMPORTANT: Comença directament amb "1. PERFIL DE L'ALUMNE".`;

    } else {
        // DOCENT
        userPrompt = `Analitza el següent document (Pla Individualitzat) i extreu-ne les adaptacions.
        
        <TEXT_PI>
        ${truncatedText}
        </TEXT_PI>

        INSTRUCCIONS DE GENERACIÓ (Imprescindible seguir l'estructura):

        1. PERFIL DE L'ALUMNE
        (Resum de 2-3 línies en forma de text seguit. Curs i dificultats globals.)

        2. DIAGNÒSTIC
        (Resum de 2-3 línies en forma de text seguit. Problema específic.)

        3. ORIENTACIÓ A L'AULA
        (Llista de punts amb guions '-'. Ex: "- Donar més temps". Neteja les 'X'.)

        4. MATÈRIES
        (ATENCIÓ: Busca a la taula. Si "Matemàtiques" té una 'X', posa: "- Matemàtiques: [Adaptació]". Si és "Totes les matèries", fes un paràgraf explicant-ho.)

        5. CRITERIS D'AVALUACIÓ
        (Llista o text segons el cas.)

        RESPOSTA:`;
    }

    const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
    ];

    try {
        console.log(`🤖 [aiService] Enviant petició a IA Local...`);
        const completion = await openai.chat.completions.create({
            model: MODEL_NAME,
            messages: messages,
            temperature: 0.1,
            max_tokens: 2000,
            stream: true,
            top_p: 0.9,
            presence_penalty: 0.6,
            frequency_penalty: 1.1
        });

        console.log("🤖 [aiService] Connexió establerta amb LLM! Esperant el primer token (Fase de Lectura/Pre-fill)...");

        let fullText = "";
        // Seccions esperades per calcular el progrés (aprox 20% per secció)
        // MODIFICAT: Keywords actualitzades segons els nous prompts (Docent/Orientador)
        const sections = ["PERFIL", "DADES", "DIAGNÒSTIC", "ORIENTACIÓ", "ADAPTACIONS", "MATÈRIES", "ASSIGNATURES", "CRITERIS", "JUSTIFICACIÓ"];
        let isFirst = true;
        let chunkCount = 0;

        for await (const chunk of completion) {
            // FASE 2: ESCRIPTURA (Reset a 0% -> 100%)
            if (isFirst) {
                console.log("🤖 [aiService] Primer token rebut! Comença la generació de text.");
                isFirst = false;
                currentProgress = 0; // Reiniciem la barra per a la fase d'escriptura
            }

            chunkCount++;
            const content = chunk.choices[0]?.delta?.content || "";

            // Log de "batec" cada 10 chunks per veure que està viu a la terminal (Més freqüent)
            if (chunkCount % 10 === 0) {
                console.log(`... generant (${chunkCount} tokens)`); // Més visible als logs de Docker
            }

            fullText += content;

            if (onProgress) {
                // Càlcul simple de progrés: Quantes seccions hem trobat ja?
                let foundCount = 0;
                sections.forEach(s => {
                    if (fullText.includes(s)) foundCount++;
                });

                // Càlcul de progrés d'escriptura (0 a 100)
                // MODIFICAT: Ajustem a 2000 tokens (resum complet)
                // (chunkCount / 20) -> 2000 tokens = 100%
                const chunkProgress = (chunkCount / 20);
                const sectionProgress = foundCount * 5; // Més pes a les seccions per compensar

                let writeProgress = chunkProgress + sectionProgress;

                // Enviem text ple -> Servidor marca "GENERANT..."
                // AWAIT IMPORTANT: Esperem que s'actualitzi la BD abans de continuar per evitar race conditions al final
                await onProgress(fullText, Math.min(Math.floor(writeProgress), 99));
            }
        }

        console.log(`🤖 [IA Local] Generació finalitzada amb èxit. Longitud: ${fullText.length} caràcters.`);
        return fullText;
    } catch (error) {
        console.error("❌ Error IA Local:", error);
        throw new Error("Error connectant amb el contenidor d'IA Local.");
    }
}

/**
 * Xat ràpid amb el document.
 * @param {string} text - Text del document
 * @param {string} question - Pregunta de l'usuari
 */
async function chatWithDocument(text, question) {
    // OPTIMITZACIÓ EXTREMA: 1200 chars per velocitat màxima al xat
    const MAX_CHARS = 1200;
    const truncatedText = text.length > MAX_CHARS ? text.substring(0, MAX_CHARS) + "..." : text;

    const messages = [
        {
            role: "system",
            content: `Ets un motor de cerca semàntic.
            TASCA: Interpretar què vol l'usuari i trobar la frase LITERAL del text que ho respon, encara que no faci servir les mateixes paraules.
            
            EXEMPLES:
            - "comportament" -> Busca frases sobre "conducta", "actitud", "normes".
            - "què té?" -> Busca "diagnòstic", "trastorn", "dificultats".
            
            RESPOSTA: Retorna NOMÉS el fragment de text exacte del document. Si no ho trobes, digues NO_TROBAT.`
        },
        {
            role: "user",
            content: `DOCUMENT:\n"${truncatedText}"\n\nPREGUNTA: "${question}"\n\nRESPOSTA LITERAL DEL DOCUMENT:`
        }
    ];

    try {
        const completion = await openai.chat.completions.create({
            model: MODEL_NAME,
            messages: messages,
            temperature: 0.0, // Determinista (sempre la mateixa resposta)
            max_tokens: 60, // Molt curt (només volem la frase)
            stream: false
        });
        return completion.choices[0].message.content;
    } catch (error) {
        console.error("❌ Error Chat IA:", error);
        throw new Error("Error connectant amb la IA.");
    }
}

module.exports = { generateSummaryLocal, checkConnection, chatWithDocument };