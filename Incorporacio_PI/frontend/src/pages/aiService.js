// Servei per connectar amb Ollama (IA Local) des del navegador

const OLLAMA_API_URL = 'http://localhost:11434/api/generate';
const MODEL_NAME = 'tinyllama';

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

export async function resumirTextoPI(texto, onProgress, onStatus) {
  const MAX_CHARS = 12000;
  const textoNet = texto.length > MAX_CHARS ? texto.substring(0, MAX_CHARS) + "..." : texto;

  if (onStatus) onStatus("Analitzant estructura (taules i caselles)...");

  // PROMPT MILLORAT PER A TAULES I TICKS
  const prompt = `
  Act as an expert educational psychologist. Analyze this text from an Individualized Plan (PI).
  
  IMPORTANT: The text comes from a PDF. 
  - Look for CHECKBOXES or TICKS (like '[x]', 'X', 'V', or marked options) inside lists or tables. If an option is marked, it is ACTIVE.
  - Understand unstructured TABLES. Columns might be merged.
  
  Summarize the KEY ADAPTATIONS found (only the ones marked or explicitly stated).
  
  TEXT TO ANALYZE:
  "${textoNet}"
  
  SUMMARY (Concise):
  `;

  return await generateStream(prompt, onProgress);
}