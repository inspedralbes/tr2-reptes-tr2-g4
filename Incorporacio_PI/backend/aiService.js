require('dotenv').config();
const OpenAI = require("openai");

// Configuració del client per a IA LOCAL
const openai = new OpenAI({
  baseURL: "http://llm:8080/v1", // Connecta amb el contenidor 'llm' del docker-compose
  apiKey: "sk-no-key-required",  // La IA local no necessita clau real
});

/**
 * Genera un resum utilitzant IA LOCAL (sense streaming HTTP directe).
 * Retorna el text complet quan acaba.
 * @param {function} onProgress - Callback opcional (textParcial, percentatge)
 */
async function generateSummaryLocal(text, onProgress) {

  // Retallem el text per no saturar el context del model
  const MAX_CHARS = 25000; // Ajustat per a context de 8k tokens
  const truncatedText = text.length > MAX_CHARS ? text.substring(0, MAX_CHARS) + "..." : text;

  const messages = [
    {
      role: "system",
      content: `Ets un analista documental expert. La teva missió és facilitar el traspàs d'informació d'alumnes que passen de Secundària a Formació Professional (FP).
      
      OBJECTIU PRINCIPAL: El nou centre ha de rebre informació clara sobre:
      1. Les adaptacions educatives aplicades.
      2. Quines han funcionat i en quin context.
      3. Quines es podrien aplicar o adaptar al nou centre (FP).

      ESTRUCTURA OBLIGATÒRIA: Has de generar CINC seccions. Cada secció ha de començar AMB EL TÍTOL EXACTE en una línia separada, sense text addicional en aquella línia. Els títols són:
      1. PERFIL DE L'ALUMNE
      2. DIFICULTATS I BARRERES
      3. ADAPTACIONS METODOLÒGIQUES
      4. AVALUACIÓ I QUALIFICACIÓ
      5. RECOMANACIONS I TRASPÀS

      REGLA D'OR DEL FORMAT "DETALL":
      Per a cada punt, has de seguir aquest format: "Idea principal resumida. [[Detall: **[Font: Secció]** Copia aquí el text original complet del PDF per si el docent necessita més context o informació extra.]]".
      NO resumeixis en excés, extreu les frases clau literals.

      INSTRUCCIONS ESPECÍFIQUES:
      - **Perfil**: Resum breu (2-3 línies) amb dades acadèmiques, diagnòstic i motiu.
      - **Adaptacions per Matèries**: 
        - FORMAT: Fes una llista on cada punt comenci amb l'assignatura o àmbit seguit de dos punts.
        - Exemple: "- Matemàtiques: Ús de calculadora..."
        - NO facis taules Markdown. Utilitza llistes per aprofitar millor l'espai en columnes.
      - **Recomanacions**: Redacta un text fluid però MOLT ESPECÍFIC. NO facis servir frases genèriques com "continuar amb les adaptacions". Has d'explicar QUINES són (ex: "Donar més temps", "Ús de calculadora", "Pautes escrites").
      - **Exhaustivitat**: Processa totes les pàgines.
      - **Taules Originals**: Si detectes taules amb 'X' al PDF, indica clarament què està marcat dins del detall.
      - **Noms**: Ignora noms de professionals.

      Exemple de sortida desitjada:
      - Matemàtiques: Ús de calculadora. [[Detall: **[Font: Adaptacions]** L'alumne millora amb calculadora...]]

      Processa tot el text proporcionat.`
    },
    {
      role: "user",
      content: `Analitza aquest PI i extreu-ne la informació rellevant:\n\n${truncatedText}`
    }
  ];

  try {
    console.log("🤖 [aiService] Enviant petició a IA Local...");
    const completion = await openai.chat.completions.create({
      model: "default-model", // El nom és indiferent per a llama.cpp
      messages: messages,
      temperature: 0.1,
      stream: true, // ACTIVEM STREAMING per veure el progrés
    });

    let fullText = "";
    // Seccions esperades per calcular el progrés (aprox 20% per secció)
    const sections = ["PERFIL", "DIFICULTATS", "ADAPTACIONS", "AVALUACIÓ", "RECOMANACIONS"];

    for await (const chunk of completion) {
        const content = chunk.choices[0]?.delta?.content || "";
        fullText += content;

        if (onProgress) {
            // Càlcul simple de progrés: Quantes seccions hem trobat ja?
            let foundCount = 0;
            sections.forEach(s => {
                if (fullText.includes(s)) foundCount++;
            });
            
            // Base 5% per començar, +19% per cada secció trobada
            const progress = 5 + (foundCount * 19);
            
            // Enviem actualització
            onProgress(fullText, Math.min(progress, 99));
        }
    }

    console.log(`🤖 [IA Local] Generació finalitzada amb èxit. Longitud: ${fullText.length} caràcters.`);
    return fullText;
  } catch (error) {
    console.error("❌ Error IA Local:", error);
    throw new Error("Error connectant amb el contenidor d'IA Local.");
  }
}

module.exports = { generateSummaryLocal };