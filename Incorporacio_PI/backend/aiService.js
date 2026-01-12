const { InferenceClient } = require("@huggingface/inference");

// Llegim el token del .env (que ja carrega el server.js)
const HF_TOKEN = process.env.VITE_HF_ACCESS_TOKEN;

/**
 * Genera un resum utilitzant Hugging Face i l'envia per streaming a la resposta Express.
 * @param {string} text - Text a resumir
 * @param {object} res - Objecte Response d'Express per fer streaming
 */
async function generateSummaryStream(text, res) {
  if (!HF_TOKEN) {
    console.error("Manca el token VITE_HF_ACCESS_TOKEN");
    res.write("Error: Token de Hugging Face no configurat al servidor.");
    res.end();
    return;
  }

  const client = new InferenceClient(HF_TOKEN);

  // Retallem per seguretat (Qwen 2.5 72B té 32k context ~ 128k chars, pugem a 150k)
  const MAX_CHARS = 150000;
  const truncatedText = text.length > MAX_CHARS ? text.substring(0, MAX_CHARS) + "..." : text;

  const messages = [
    {
      role: "system",
      content: `Ets un analista documental expert. La teva missió és facilitar el traspàs d'informació d'alumnes que passen de Secundària a Formació Professional (FP).
      
      OBJECTIU PRINCIPAL: El nou centre ha de rebre informació clara sobre:
      1. Les adaptacions educatives aplicades.
      2. Quines han funcionat i en quin context.
      3. Quines es podrien aplicar o adaptar al nou centre (FP).

      ESTRUCTURA OBLIGATÒRIA (Fes servir aquests títols exactes):
      1. PERFIL DE L'ALUMNE
      2. DIFICULTATS I BARRERES
      3. ADAPTACIONS METODOLÒGIQUES
      4. AVALUACIÓ I QUALIFICACIÓ
      5. RECOMANACIONS I TRASPÀS

      REGLA D'OR DEL FORMAT "DETALL":
      L'usuari vol veure TOTA la informació original i saber d'on surt. NO resumeixis en excés, extreu les frases clau literals. Per a cada punt, has de seguir aquest format:
      "Idea principal. [[Detall: **[Font: Secció]** Copia aquí tot el text original...]]"

      INSTRUCCIONS ESPECÍFIQUES:
      - **Perfil**: Resum breu (2-3 línies) amb dades acadèmiques, diagnòstic i motiu.
      - **Adaptacions per Matèries**: OBLIGATORI: Fes una TAULA MARKDOWN (| Assignatura | Adaptació |). NO facis servir llistes per a les matèries.
      - **Recomanacions**: Consells clars per al nou centre (FP).
      - **Exhaustivitat**: Processa totes les pàgines.
      - **Taules Originals**: Si detectes taules amb 'X' al PDF, indica clarament què està marcat dins del detall.
      - **Noms**: Ignora noms de professionals.

      Exemple de sortida desitjada:
      | Matemàtiques | Ús de calculadora. [[Detall: **[Font: Adaptacions]** L'alumne millora amb calculadora...]] |

      Processa tot el text proporcionat.`
    },
    {
      role: "user",
      content: `Analitza aquest PI i extreu-ne la informació rellevant:\n\n${truncatedText}`
    }
  ];

  try {
    const stream = client.chatCompletionStream({
      model: "meta-llama/Llama-3.3-70B-Instruct",
      messages: messages,
      max_tokens: 8000,
      temperature: 0.2
    });

    for await (const chunk of stream) {
      if (chunk.choices && chunk.choices.length > 0) {
        const content = chunk.choices[0].delta.content || "";
        // Escrivim directament al stream de resposta HTTP
        res.write(content);
      }
    }
    
    res.end(); // Tanquem la connexió quan acabem

  } catch (error) {
    console.error("Error Hugging Face:", error);
    res.write("\n[Error generant el resum]");
    res.end();
  }
}

module.exports = { generateSummaryStream };