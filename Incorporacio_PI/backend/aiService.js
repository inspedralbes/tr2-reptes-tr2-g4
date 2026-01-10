// Este servicio se encarga de comunicar tu aplicación JS con el modelo local Ollama

const OLLAMA_API_URL = 'http://localhost:11434/api/generate';
const MODEL_NAME = 'tinyllama'; // Canviat a tinyllama per velocitat

/**
 * Funció auxiliar per gestionar el streaming d'Ollama
 */
async function generateStream(prompt, onProgress) {
  const response = await fetch(OLLAMA_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL_NAME,
      prompt: prompt,
      stream: true,
      keep_alive: -1
    }),
  });

  if (!response.ok) throw new Error('Error connectant amb Ollama');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop(); 

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const json = JSON.parse(line);
        if (json.response) {
          fullText += json.response;
          if (onProgress) onProgress(fullText);
        }
      } catch (e) { console.warn("Error JSON:", e); }
    }
  }
  return fullText;
}

/**
 * Resumeix el text en dos passos: Primer resumeix en anglès (més qualitat) i després tradueix al català.
 * @param {string} texto - Text a processar
 * @param {function} onProgress - Callback per al text (streaming)
 * @param {function} onStatus - Callback per a l'estat (Fase 1, Fase 2...)
 */
export async function resumirTextoPI(texto, onProgress, onStatus) {
  try {
    const MAX_CHARS = 12000;
    const textoNet = texto.length > MAX_CHARS 
      ? texto.substring(0, MAX_CHARS) + "..." 
      : texto;

    console.log(`🚀 Generant resum en anglès...`);
    if (onStatus) onStatus("Analyzing document and generating summary...");
    
    // PAS ÚNIC: Resumir en anglès directament
    const summary = await generateStream(
      `You are an expert educational psychologist. Analyze the provided text from an Individualized Education Plan (IEP/PI).
      The text is extracted from a PDF and might contain formatting artifacts, unstructured tables, or merged columns.
      Your task is to identify the key information despite these issues.
      
      EXTRACT ONLY the real information found in the text. DO NOT invent anything.

      Structure the summary exactly as follows:
      - **Diagnosis/Needs**: (Extract specific disorders like ADHD, Dyslexia, etc.)
      - **Key Adaptations**: (List specific measures like "more time", "use of computer", "calculator", etc.)
      - **Evaluation**: (How exams/grades should be adapted, e.g., "do not penalize spelling")
      
      Text to analyze:\n"${textoNet}"\n\nSummary:`,
      onProgress
    );

    if (onStatus) onStatus("Process finished.");
    return summary;
  } catch (error) {
    console.error('Error generant resum:', error);
    throw error;
  }
}