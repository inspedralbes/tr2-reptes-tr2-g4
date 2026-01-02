/**
 * Llegeix un buffer de PDF i retorna el text pla.
 * @param {Buffer} buffer - El fitxer PDF en memòria
 */
async function extractTextFromPDF(buffer) {
    try {
        // 1. Importació dinàmica per a la versió moderna (v4+) de pdfjs-dist
        // Això soluciona l'error "Cannot find module" i permet fer servir la versió segura
        // FIX: Usem la versió 'legacy' que inclou polyfills per a Node.js (evita error DOMMatrix)
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

        // 2. Convertim el buffer a Uint8Array (format requerit)
        const data = new Uint8Array(buffer);

        // 3. Carreguem el document
        const loadingTask = pdfjs.getDocument({ 
            data: data,
            verbosity: 0, // Silenciem warnings no crítics
            disableFontFace: true // Evitem errors de fonts en entorn servidor
        });

        const doc = await loadingTask.promise;
        let fullText = "";

        // 4. Iterem per totes les pàgines
        for (let i = 1; i <= doc.numPages; i++) {
            const page = await doc.getPage(i);
            const textContent = await page.getTextContent();
            
            // MILLORA: Unim amb salt de línia (\n) en lloc d'espai per respectar l'estructura del formulari
            const pageText = textContent.items.map(item => item.str).join('\n');
            fullText += pageText + "\n";
        }

        // 5. Logs de control
        if (fullText.length < 10) {
            console.log("⚠️ ALERTA: El PDF sembla buit o és una imatge escanejada (OCR necessari).");
        } else {
            console.log(`✅ PDF llegit correctament (pdfjs-dist v4): ${fullText.length} caràcters extrets.`);
        }

        return fullText;

    } catch (error) {
        console.error("❌ Error al fileReader (pdfjs-dist):", error.message);
        return ""; // Retornem buit en lloc de llançar error
    }
}

module.exports = { extractTextFromPDF };