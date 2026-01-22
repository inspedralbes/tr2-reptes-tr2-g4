const fs = require('fs');
const pdf = require('pdf-parse-fork');
const AdmZip = require('adm-zip');
const path = require('path');

// --- 1. EXTRACTOR PDF (Existente) ---
async function extractTextFromPDF(buffer) {
    try {
        const data = await pdf(buffer);
        return data.text;
    } catch (error) {
        console.error('Error al leer PDF:', error);
        return null;
    }
}

// --- 2. EXTRACTOR DOCX RÁPIDO (Nuevo - Basado en el código de referencia) ---
function extractRawXMLText(bufferOrPath) {
    try {
        const zip = new AdmZip(bufferOrPath);
        const zipEntries = zip.getEntries();
        const docEntry = zipEntries.find(entry => entry.entryName === 'word/document.xml');

        if (!docEntry) return "";

        const xmlContent = docEntry.getData().toString('utf8');

        // 1. Reemplazar cierres de párrafo/celda por saltos de línea para mantener estructura visual
        let text = xmlContent.replace(/<\/w:p>/g, '\n').replace(/<\/w:tc>/g, ' ');
        // 2. Eliminar todas las etiquetas XML
        text = text.replace(/<[^>]+>/g, '');
        // 3. Limpiar espacios múltiples
        text = text.replace(/\s+/g, ' ').trim();

        // 4. Parche específico para palabras pegadas comunes (Detectado en referencia)
        text = text.replace(/Datadenaixement/g, "Data de naixement");
        text = text.replace(/Datade/g, "Data de");

        return text;
    } catch (e) {
        console.error("Error extrayendo XML de DOCX:", e.message);
        return "";
    }
}

// --- 3. EXTRACTOR ODT (Existente/Mejorado) ---
function extractTextFromODT(buffer) {
    try {
        const zip = new AdmZip(buffer);
        const contentXml = zip.readAsText("content.xml");
        return contentXml
            .replace(/<text:p[^>]*>/g, '\n')
            .replace(/<[^>]+>/g, ' ')
            .trim();
    } catch (e) {
        console.error("Error extrayendo ODT:", e);
        return "";
    }
}

// --- 4. EXTRACTOR UNIFICAT (Helper) ---
async function extractTextFromFile(filePath, originalFilename = null) {
    if (!fs.existsSync(filePath)) return null;
    const buffer = fs.readFileSync(filePath);

    // Prefer originalFilename if provided, otherwise fallback to filePath (which might be random hash)
    const nameToCheck = (originalFilename || filePath).toLowerCase();

    if (nameToCheck.endsWith('.odt')) {
        return extractTextFromODT(buffer);
    } else if (nameToCheck.endsWith('.docx')) {
        return extractRawXMLText(buffer);
    } else {
        return await extractTextFromPDF(buffer);
    }
}

module.exports = { extractTextFromPDF, extractRawXMLText, extractTextFromODT, extractTextFromFile };